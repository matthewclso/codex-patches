function Remove-LegacyPatches {
    $state = Get-ActiveRuntime
    $doctorPath = Join-Path $state.active.deployment 'last-doctor.json'
    if (-not (Test-Path $doctorPath) -or -not (Read-JsonFile $doctorPath).success) { throw 'Run doctor successfully before planning legacy removal.' }
    $LegacyRoot = [IO.Path]::GetFullPath($LegacyRoot)
    if ((Split-Path $LegacyRoot -Leaf) -ne '.codex-wsl-launcher' -or $LegacyRoot -eq [IO.Path]::GetFullPath($InstallRoot)) { throw 'Legacy cleanup accepts only the historical .codex-wsl-launcher directory.' }
    if (-not (Test-Path -LiteralPath $LegacyRoot)) { Write-Host 'Legacy launcher directory is already absent.'; return }
    $rootItem = Get-Item -LiteralPath $LegacyRoot -Force
    if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Legacy launcher root cannot be a link.' }
    if (-not (Test-Path (Join-Path $LegacyRoot 'Start-Codex-Wsl-Alias.ps1'))) { throw 'The historical launcher marker is absent; manual review is required.' }
    $wrapperValid = $LegacyWrapper -and (Test-Path -LiteralPath $LegacyWrapper) -and ([IO.File]::ReadAllText($LegacyWrapper,[Text.Encoding]::UTF8).Contains('.codex-wsl-launcher'))
    if ($LegacyWrapper -and -not $wrapperValid) { throw 'The supplied wrapper does not reference the historical launcher.' }
    $codexHomeWindows = Get-WindowsPath $state.runtime.codexHome
    $legacyProfile = Split-Path $LegacyRoot -Parent
    $alias = Join-Path $legacyProfile '.codex-wsl-pets-shim'
    $aliasLinux = Get-WslPath $alias
    $mirror = Join-Path ([IO.Path]::GetPathRoot($LegacyRoot)) $aliasLinux.TrimStart('/').Replace('/','\')
    $linuxHome = Invoke-WslPython 'import pathlib;print(pathlib.Path.home())'
    $oldProxy = "$linuxHome/.local/bin/codex-project-path-proxy"
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
    $plan = @{schemaVersion=1;legacyRoot=$LegacyRoot;wrapper=$LegacyWrapper;shortcutCount=$shortcuts.Count;linuxProxy=$oldProxy;homeAliases=@($alias,$mirror);preserve='Codex data, private relay state and account/project backups outside the launcher remain in place. Diagnostics and browser sandbox data inside the launcher are moved into legacy-data.';applied=$false}
    Write-JsonFile (Join-Path $InstallRoot 'legacy-cleanup-plan.json') $plan
    $plan | ConvertTo-Json -Depth 6 | Write-Host
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
    # Inspect links without traversing them, before changing any shortcut,
    # junction, proxy or wrapper. A refusal leaves the legacy setup intact.
    $pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($LegacyRoot)
    while ($pending.Count -gt 0) {
        $directory = $pending.Pop()
        foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The legacy tree contains links. Review them before removing code.' }
            if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
        }
    }
    $preserved = Join-Path $InstallRoot "legacy-data\$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))"
    Set-PrivateDirectory $preserved
    # Keep data/diagnostics, not application copies or executable patch backups.
    foreach ($file in Get-ChildItem -LiteralPath $LegacyRoot -File) {
        if ($file.Extension -in @('.json','.log','.png') -or $file.Name -match '\.sqlite') { Copy-Item -LiteralPath $file.FullName -Destination $preserved }
    }
    $sandbox = Join-Path $LegacyRoot 'browser-sandbox'
    if (Test-Path $sandbox) {
        if ((Get-Item $sandbox -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Browser sandbox is linked; review its data manually.' }
        Copy-Item -LiteralPath $sandbox -Destination (Join-Path $preserved 'browser-sandbox') -Recurse
    }
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
    $plan.applied = $true; $plan.preservedDiagnostics = $preserved
    Write-JsonFile (Join-Path $InstallRoot 'legacy-cleanup-plan.json') $plan
    Write-Host 'Historical launcher, app copies, shims, custom binaries and proxy removed. Shared data and private pairing/repair backups were preserved.'
}
