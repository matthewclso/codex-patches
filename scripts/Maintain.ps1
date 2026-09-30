function Get-ActiveRuntime {
    $active = Read-JsonFile (Join-Path $InstallRoot 'active.json')
    $install = Read-JsonFile (Join-Path $active.deployment 'install.json')
    $script:SelectedDistro = $install.distro
    $json = Invoke-WslPython 'import pathlib,sys;print(pathlib.Path(sys.argv[1]).read_text())' @($install.runtimeConfig)
    return @{active=$active;install=$install;runtime=($json | ConvertFrom-Json)}
}
function Test-DeploymentInUse([string]$Deployment) {
    $processes = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($Deployment + '\',[StringComparison]::OrdinalIgnoreCase) })
    if ($processes.Count -gt 0) { return $true }
    $linux = Get-WslPath $Deployment
    $found = Invoke-WslPython @'
import pathlib,sys
needle=sys.argv[1].encode();found=False
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  if needle in (p/'cmdline').read_bytes():found=True;break
 except (PermissionError,FileNotFoundError,ProcessLookupError):pass
print(int(found))
'@ @($linux)
    return $found -eq '1'
}
function Repair-CodexProjects {
    $state = Get-ActiveRuntime
    if ($Apply -and @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Close Codex before applying a project membership repair.' }
    $tool = (Get-WslPath $state.active.deployment) + '/toolkit/tools/repair-project-memberships.cjs'
    $r = $state.runtime
    $args = @($r.node,$tool,"--home=$($r.codexHome)","--sqlite=$($r.sqliteHome)","--binary=$($r.realCli)","--backup=$($r.stateRoot)/project-backups")
    if ($Apply) { $args += '--apply' }
    Invoke-Wsl $args | Write-Host
}
function Remove-OldDeployments {
    $state = Get-ActiveRuntime
    foreach ($directory in Get-ChildItem -LiteralPath (Join-Path $InstallRoot 'versions') -Directory) {
        if ($directory.FullName -eq $state.active.deployment) { continue }
        if ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Cleanup refuses linked deployment directories.' }
        if (-not (Test-Path (Join-Path $directory.FullName 'receipt.json')) -or -not (Test-Path (Join-Path $directory.FullName 'install.json'))) { Write-Host "Unrecognized directory preserved: $($directory.FullName)"; continue }
        if (Test-DeploymentInUse $directory.FullName) { Write-Host "In-use deployment preserved: $($directory.Name)"; continue }
        if ($Apply) {
            $old = Read-JsonFile (Join-Path $directory.FullName 'install.json')
            Invoke-WslPython @'
import pathlib,sys
p=pathlib.Path(sys.argv[1]);root=pathlib.Path(sys.argv[2])/'deployments'
if p.name!='runtime.json' or p.parent.parent!=root or p.parent.is_symlink():raise SystemExit('Unrecognized runtime path')
p.unlink(missing_ok=True)
try:p.parent.rmdir()
except OSError:pass
'@ @($old.runtimeConfig,$old.stateRoot) | Out-Null
            Remove-Item -LiteralPath $directory.FullName -Recurse -Force
            Write-Host "Removed $($directory.Name)"
        } else { Write-Host "Would remove $($directory.Name). Use cleanup -Apply after reviewing this list." }
    }
}
function Uninstall-CodexPatches {
    $state = Get-ActiveRuntime
    if (-not $Apply) { Write-Host "Would remove generated app copies, toolkit launcher, owned proxy and shortcut. Shared Codex data and private relay/pairing backups are preserved. Use uninstall -Apply."; return }
    foreach ($directory in Get-ChildItem -LiteralPath (Join-Path $InstallRoot 'versions') -Directory) {
        if (Test-DeploymentInUse $directory.FullName) { throw 'A generated deployment is in use. Close patched Codex and its terminals before uninstalling.' }
    }
    Invoke-WslPython @'
import json,os,pathlib,sys
p=pathlib.Path('/usr/local/bin/codex-patches-proxy');owner=pathlib.Path('/usr/local/share/codex-patches-owner.json')
if owner.exists():
 record=json.loads(owner.read_text())
 if record.get('uid')!=int(sys.argv[1]):raise SystemExit('Proxy belongs to another user')
 if p.is_symlink() and os.readlink(p)==record.get('target'):p.unlink();owner.unlink()
 elif p.exists() or p.is_symlink():raise SystemExit('Proxy changed; refusing removal')
'@ @((Invoke-Wsl @('/usr/bin/id','-u'))) -RootUser | Out-Null
    foreach ($junction in $state.install.ownedJunctions) {
        if (Test-Path -LiteralPath $junction.path) {
            $item = Get-Item -LiteralPath $junction.path -Force
            if ($item.LinkType -ne 'Junction' -or @($item.Target)[0] -ne $junction.target) { throw 'Owned home alias changed; refusing removal.' }
            [IO.Directory]::Delete($junction.path)
        }
    }
    $shortcutRecord = Join-Path $InstallRoot 'shortcut.json'
    if (Test-Path $shortcutRecord) {
        $record = Read-JsonFile $shortcutRecord
        if (Test-Path -LiteralPath $record.path) {
            $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($record.path)
            if ($shortcut.TargetPath -eq $record.target -and $shortcut.Arguments -eq $record.arguments) { Remove-Item -LiteralPath $record.path -Force }
        }
    }
    # Remove generated copies only. Keep audit receipts and private runtime state
    # needed by existing enrollment IDs or an explicit conditional rollback.
    foreach ($directory in Get-ChildItem -LiteralPath (Join-Path $InstallRoot 'versions') -Directory) {
        if ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing linked deployment directory.' }
        if (Test-Path (Join-Path $directory.FullName 'receipt.json')) { Remove-Item -LiteralPath $directory.FullName -Recurse -Force }
    }
    foreach ($name in @('active.json','launch.ps1','shortcut.json')) { Remove-Item -LiteralPath (Join-Path $InstallRoot $name) -Force -ErrorAction SilentlyContinue }
    Write-Host 'Toolkit launchers and generated app copies removed. The signed app and Codex data are preserved.'
}
