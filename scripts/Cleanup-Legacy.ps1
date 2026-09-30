function Get-LegacyAuditInventory([string]$Root) {
    $Root = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\','/'))
    $rootItem = Get-Item -LiteralPath $Root -Force
    if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Legacy launcher root cannot be a link.' }
    $files = @()
    $pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($Root)
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The legacy tree contains links. Review them before removing code.' }
            if ($entry.PSIsContainer) { $pending.Push($entry.FullName); continue }
            $relative = $entry.FullName.Substring($Root.Length + 1).Replace('\','/')
            $parts = $relative.ToLowerInvariant().Split('/')
            $data = @($parts | Where-Object { $_ -match '^probe-state(?:[-_.][A-Za-z0-9]+)*$' }).Count -gt 0 -or $parts -contains 'browser-sandbox'
            $appCode = $parts -contains 'app' -or $parts -contains 'node_modules'
            if ($data -or (-not $appCode -and ($entry.Extension -in @('.json','.md','.log','.png') -or $entry.Name -match '\.sqlite(?:-(?:wal|shm))?$'))) {
                $files += [ordered]@{relativePath=$relative;sha256=(Get-Sha256File $entry.FullName);length=$entry.Length}
            }
        }
    }
    return @($files | Sort-Object { $_.relativePath })
}

function Copy-LegacyAuditInventory([string]$Root, [string]$Destination, $Inventory) {
    foreach ($entry in $Inventory) {
        $source = Join-Path $Root $entry.relativePath
        $current = Get-Item -LiteralPath $source -Force
        while ($current.FullName.Length -ge $Root.Length) {
            if ($current.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Legacy audit paths changed to links; no code was removed.' }
            $current = Get-Item -LiteralPath (Split-Path $current.FullName -Parent) -Force
        }
        if ((Get-Sha256File $source) -ne $entry.sha256) { throw 'Legacy audit data changed; no code was removed.' }
        $target = Join-Path $Destination $entry.relativePath
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target
        if ((Get-Sha256File $target) -ne $entry.sha256 -or (Get-Sha256File $source) -ne $entry.sha256) { throw 'Legacy audit backup verification failed; no code was removed.' }
    }
}

function Get-LegacySourceReferences([string]$Root, $Inventory) {
    $references = @()
    foreach ($entry in $Inventory) {
        if ($entry.relativePath -notmatch '^bin/([^/]+)/manifest\.json$') { continue }
        $version = $Matches[1]
        $manifest = Read-JsonFile (Join-Path $Root $entry.relativePath)
        if (-not $manifest.PSObject.Properties['source'] -or -not $manifest.source.PSObject.Properties['localPath']) { continue }
        if (-not $manifest.source.PSObject.Properties['repository'] -or -not $manifest.PSObject.Properties['artifact'] -or -not $manifest.artifact.PSObject.Properties['buildScript']) { throw 'A historical source declaration lacks its repository/build marker; manual review is required.' }
        $references += @{version=$version;repository=$manifest.source.repository;localPath=$manifest.source.localPath;buildScript=$manifest.artifact.buildScript}
    }
    return $references
}

function Remove-LegacyPatches {
    $state = Get-ActiveRuntime
    $doctorPath = Join-Path $state.active.deployment 'last-doctor.json'
    if (-not (Test-Path $doctorPath) -or -not (Read-JsonFile $doctorPath).success) { throw 'Run doctor successfully before planning legacy removal.' }
    $LegacyRoot = [IO.Path]::GetFullPath($LegacyRoot).TrimEnd([char[]]@('\','/'))
    if ((Split-Path $LegacyRoot -Leaf) -ne '.codex-wsl-launcher' -or $LegacyRoot -eq [IO.Path]::GetFullPath($InstallRoot)) { throw 'Legacy cleanup accepts only the historical .codex-wsl-launcher directory.' }
    if (-not (Test-Path -LiteralPath $LegacyRoot)) { Write-Host 'Legacy launcher directory is already absent.'; return }
    $rootItem = Get-Item -LiteralPath $LegacyRoot -Force
    if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Legacy launcher root cannot be a link.' }
    if (-not (Test-Path (Join-Path $LegacyRoot 'Start-Codex-Wsl-Alias.ps1'))) { throw 'The historical launcher marker is absent; manual review is required.' }
    if ($LegacyWrapper -and (Test-Path -LiteralPath $LegacyWrapper) -and ((Get-Item -LiteralPath $LegacyWrapper -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'The supplied wrapper cannot be a link.' }
    $wrapperValid = $LegacyWrapper -and (Test-Path -LiteralPath $LegacyWrapper) -and ([IO.File]::ReadAllText($LegacyWrapper,[Text.Encoding]::UTF8).Contains('.codex-wsl-launcher'))
    if ($LegacyWrapper -and -not $wrapperValid) { throw 'The supplied wrapper does not reference the historical launcher.' }
    $codexHomeWindows = Get-WindowsPath $state.runtime.codexHome
    $legacyProfile = Split-Path $LegacyRoot -Parent
    $alias = Join-Path $legacyProfile '.codex-wsl-pets-shim'
    $aliasLinux = Get-WslPath $alias
    $mirror = Join-Path ([IO.Path]::GetPathRoot($LegacyRoot)) $aliasLinux.TrimStart('/').Replace('/','\')
    $linuxHome = Invoke-WslPython 'import pathlib;print(pathlib.Path.home())'
    $oldProxy = "$linuxHome/.local/bin/codex-project-path-proxy"
    # Inventory diagnostics at every depth, while refusing links even in app
    # directories whose executable contents will not be copied to the archive.
    $auditFiles = @(Get-LegacyAuditInventory $LegacyRoot)
    $sourceReferences = @(Get-LegacySourceReferences $LegacyRoot $auditFiles)
    $sourceCode = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\tools\legacy-source-cleanup.py'),[Text.Encoding]::UTF8)
    $referencesJson = ConvertTo-Json -InputObject $sourceReferences -Depth 6 -Compress
    $sourceJson = Invoke-WslPython $sourceCode @('plan',"--home=$linuxHome","--references=$referencesJson")
    $sourcePlan = @()
    foreach ($record in (ConvertFrom-Json -InputObject $sourceJson)) {
        # PS5's JSON array wrapper otherwise serializes as {value,Count}.
        $source = [ordered]@{version=$record.version;path=$record.path;status=$record.status}
        if ($record.status -eq 'removable') { $source.entryCount=$record.entryCount; $source.inventorySha256=$record.inventorySha256 }
        $sourcePlan += $source
    }
    $shortcutRoots = @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'), (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned'))
    $shortcuts = @()
    $shell = New-Object -ComObject WScript.Shell
    foreach ($directory in $shortcutRoots | Select-Object -Unique) {
        if (-not (Test-Path $directory)) { continue }
        foreach ($link in Get-ChildItem -LiteralPath $directory -Recurse -File -Filter '*.lnk') {
            $shortcut = $shell.CreateShortcut($link.FullName)
            if ($shortcut.Arguments.IndexOf('.codex-wsl-launcher',[StringComparison]::OrdinalIgnoreCase) -ge 0 -or ($LegacyWrapper -and $shortcut.Arguments.IndexOf($LegacyWrapper,[StringComparison]::OrdinalIgnoreCase) -ge 0)) { $shortcuts += $link.FullName }
        }
    }
    $plan = @{schemaVersion=2;legacyRoot=$LegacyRoot;wrapper=$LegacyWrapper;shortcutCount=$shortcuts.Count;linuxProxy=$oldProxy;homeAliases=@($alias,$mirror);auditFiles=$auditFiles;linuxSourceRoots=$sourcePlan;preserve='Codex data, private relay state and account/project backups outside the launcher remain in place. Nested audit documents, probe-state and browser sandbox data are verified and archived under legacy-data before deletion.';applied=$false}
    Write-JsonFile (Join-Path $InstallRoot 'legacy-cleanup-plan.json') $plan
    @{legacyRoot=$LegacyRoot;wrapper=$LegacyWrapper;shortcutCount=$shortcuts.Count;linuxProxy=$oldProxy;homeAliases=@($alias,$mirror);auditFileCount=$auditFiles.Count;linuxSourceRoots=$sourcePlan;applied=$false;planPath=(Join-Path $InstallRoot 'legacy-cleanup-plan.json')} | ConvertTo-Json -Depth 6 | Write-Host
    if (-not $Apply) { Write-Host 'Review this plan after launching and verifying the new desktop. Apply requires -Apply -DesktopAccepted.'; return }
    if (-not $DesktopAccepted) { throw 'Confirm the new desktop checks by passing -DesktopAccepted. A startup-only doctor check cannot replace them.' }
    if (Test-DeploymentInUse $LegacyRoot) { throw 'Legacy launcher code is still in use. Close and reopen Codex using the new shortcut before cleanup.' }
    $oldProxyInUse = Invoke-WslPython @'
import os,pathlib,sys
needles=[sys.argv[1].encode(),b'/usr/local/bin/codex-project-path-proxy'];found=False
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit() or int(p.name)==os.getpid():continue
 try:
  if any(needle in (p/'cmdline').read_bytes() for needle in needles):found=True;break
 except (PermissionError,FileNotFoundError,ProcessLookupError):pass
print(int(found))
'@ @($oldProxy)
    if ($oldProxyInUse -eq '1') { throw 'The historical Linux proxy is still running; no cleanup performed.' }
    foreach ($junction in @($alias,$mirror) | Select-Object -Unique) {
        if (Test-Path -LiteralPath $junction) {
            $item = Get-Item -LiteralPath $junction -Force
            if ($item.LinkType -ne 'Junction' -or @($item.Target)[0] -ne $codexHomeWindows) { throw "Historical home alias differs from the canonical data target: $junction" }
        }
    }
    Invoke-WslPython @'
import os,pathlib,sys
p=pathlib.Path('/usr/local/bin/codex-project-path-proxy');expected=sys.argv[1]
if p.exists() or p.is_symlink():
 if not p.is_symlink() or os.readlink(p)!=expected:raise SystemExit('Historical proxy link changed; refusing removal')
p=pathlib.Path(expected)
if p.exists() or p.is_symlink():
 if p.is_symlink() or p.stat().st_uid!=os.getuid() or 'CODEX_PROJECT_PATH_PROXY_REAL_CLI' not in p.read_text():raise SystemExit('Historical proxy content/ownership changed')
'@ @($oldProxy) | Out-Null
    # Recheck the full no-follow inventory after the process/link preflight.
    $current = @(Get-LegacyAuditInventory $LegacyRoot)
    if ((ConvertTo-Json -InputObject $current -Depth 6 -Compress) -ne (ConvertTo-Json -InputObject $auditFiles -Depth 6 -Compress)) { throw 'Legacy audit inventory changed; no cleanup performed.' }
    $preserved = Join-Path $InstallRoot "legacy-data\$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
    Set-PrivateDirectory $preserved
    Copy-LegacyAuditInventory $LegacyRoot (Join-Path $preserved 'launcher') $auditFiles
    Write-JsonFile (Join-Path $preserved 'audit-inventory.json') @{legacyRoot=$LegacyRoot;files=$auditFiles}
    $sourceResult = Invoke-WslPython $sourceCode @('remove',"--home=$linuxHome","--references=$referencesJson","--expected=$(ConvertTo-Json -InputObject $sourcePlan -Depth 6 -Compress)","--archive=$(Get-WslPath $preserved)") | ConvertFrom-Json
    foreach ($path in $shortcuts) {
        Copy-Item -LiteralPath $path -Destination (Join-Path $preserved ([Guid]::NewGuid().ToString() + '.lnk'))
        $shortcut = $shell.CreateShortcut($path)
        $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $InstallRoot 'launch.ps1')`" -InstallRoot `"$InstallRoot`""
        $shortcut.WorkingDirectory = $InstallRoot
        $shortcut.IconLocation = "$(Join-Path $state.active.deployment 'app\ChatGPT.exe'),0"
        $shortcut.Save()
    }
    foreach ($junction in @($alias,$mirror) | Select-Object -Unique) {
        if (Test-Path -LiteralPath $junction) {
            $item = Get-Item -LiteralPath $junction -Force
            if ($item.LinkType -ne 'Junction' -or @($item.Target)[0] -ne $codexHomeWindows) { throw "Historical home alias differs from the canonical data target: $junction" }
            [IO.Directory]::Delete($junction)
        }
    }
    Invoke-WslPython @'
import os,pathlib,sys
p=pathlib.Path('/usr/local/bin/codex-project-path-proxy');expected=sys.argv[1]
if p.exists() or p.is_symlink():
 if not p.is_symlink() or os.readlink(p)!=expected:raise SystemExit('Historical proxy link changed; refusing removal')
 p.unlink()
'@ @($oldProxy) -RootUser | Out-Null
    Invoke-WslPython @'
import os,pathlib,sys
p=pathlib.Path(sys.argv[1])
if p.exists():
 if p.is_symlink() or p.stat().st_uid!=os.getuid() or 'CODEX_PROJECT_PATH_PROXY_REAL_CLI' not in p.read_text():raise SystemExit('Historical proxy content/ownership changed')
 p.unlink()
'@ @($oldProxy) | Out-Null
    if ($wrapperValid) { Remove-Item -LiteralPath $LegacyWrapper -Force }
    Remove-Item -LiteralPath $LegacyRoot -Recurse -Force
    $plan.applied = $true; $plan.preservedDiagnostics = $preserved; $plan.sourceCleanup = $sourceResult
    Write-JsonFile (Join-Path $InstallRoot 'legacy-cleanup-plan.json') $plan
    Write-Host 'Historical launcher, app copies, shims, custom binaries and proxy removed. Shared data and private pairing/repair backups were preserved.'
}
