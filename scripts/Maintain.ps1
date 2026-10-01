function Get-ActiveRuntime {
    $active = Read-JsonFile (Join-Path $InstallRoot 'active.json')
    $install = Read-JsonFile (Join-Path $active.deployment 'install.json')
    $script:SelectedDistro = $install.distro
    $json = Invoke-WslPython 'import pathlib,sys;print(pathlib.Path(sys.argv[1]).read_text())' @($install.runtimeConfig)
    return @{active=$active;install=$install;runtime=($json | ConvertFrom-Json)}
}
function Initialize-ProcessNativeMethods {
    if (-not ('CodexPatches.CommandLine' -as [type])) {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
namespace CodexPatches {
    public static class CommandLine {
        [DllImport("shell32.dll", SetLastError = true)]
        static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command, out int count);
        [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern uint GetLongPathName(string path, StringBuilder expanded, uint size);
        public static string LongPath(string path) {
            var expanded = new StringBuilder(32768);
            uint length = GetLongPathName(path, expanded, (uint)expanded.Capacity);
            if (length == 0 || length >= expanded.Capacity) throw new System.ComponentModel.Win32Exception();
            return expanded.ToString();
        }
        public static string[] Split(string command) {
            int count;
            IntPtr pointer = CommandLineToArgvW(command, out count);
            if (pointer == IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
            try {
                string[] result = new string[count];
                for (int i = 0; i < count; i++) result[i] = Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer, i * IntPtr.Size));
                return result;
            } finally { LocalFree(pointer); }
        }
    }
}
'@
    }
}
function Test-WindowsAppServerCommand([string]$CommandLine) {
    Initialize-ProcessNativeMethods
    # Only the app-server subcommand is a backend. A review/exec prompt or a
    # configuration value containing that word must never authorize termination.
    $arguments = [CodexPatches.CommandLine]::Split($CommandLine)
    for ($index = 1; $index -lt $arguments.Length; $index++) {
        $argument = $arguments[$index]
        if ($argument -cin @('--','--help','-h','--version','-V')) { return $false }
        if ($argument -cin @('-c','--config','--enable','--disable','--remote','--remote-auth-token-env','-i','--image','-m','--model','--local-provider','-p','--profile','-s','--sandbox','-C','--cd','--add-dir','-a','--ask-for-approval')) { $index++; continue }
        if ($argument.StartsWith('-')) { continue }
        if ($argument -cne 'app-server') { return $false }
        $tail = @($arguments | Select-Object -Skip ($index + 1))
        return @($tail | Where-Object { $_ -cin @('--help','-h','generate-ts','generate-json-schema','help') }).Count -eq 0
    }
    return $false
}
function Get-WindowsDeploymentProcesses([string]$Deployment) {
    Initialize-ProcessNativeMethods
    $requestedRoot = $Deployment.TrimEnd([char[]]@('\','/'))
    # CIM may preserve 8.3 executable paths while GetFullPath expands InstallRoot
    # (as on hosted Windows runners). Normalize both sides of the comparison.
    $root = [CodexPatches.CommandLine]::LongPath([IO.Path]::GetFullPath($requestedRoot))
    foreach ($process in Get-CimInstance Win32_Process) {
        if ($process.ProcessId -eq $PID) { continue }
        $executable = $process.ExecutablePath
        if ($executable) {
            try { $executable = [CodexPatches.CommandLine]::LongPath($executable) }
            catch [ComponentModel.Win32Exception] { } # Other users' files may be inaccessible; retain the reported path.
        }
        $executableInside = $executable -and $executable.StartsWith($root + '\',[StringComparison]::OrdinalIgnoreCase)
        $argumentReference = $process.CommandLine -and ($process.CommandLine.IndexOf($root,[StringComparison]::OrdinalIgnoreCase) -ge 0 -or $process.CommandLine.IndexOf($requestedRoot,[StringComparison]::OrdinalIgnoreCase) -ge 0)
        if (-not $executableInside -and -not $argumentReference) { continue }
        $name = $process.Name
        $activationBlocker = $executableInside -and (
            $name -ieq 'ChatGPT.exe' -or
            (($name -ieq 'codex.exe' -or $name -ieq 'codex-patches-proxy.exe') -and $process.CommandLine -and (Test-WindowsAppServerCommand $process.CommandLine))
        )
        [pscustomobject]@{platform='Windows';pid=$process.ProcessId;name=$name;activationBlocker=[bool]$activationBlocker;startToken=$process.CreationDate.ToUniversalTime().ToString('yyyyMMddHHmmssffffff')}
    }
}
function Get-DeploymentProcesses([string]$Deployment) {
    Get-WindowsDeploymentProcesses $Deployment
    $linux = Get-WslPath $Deployment
    $code = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\tools\deployment-processes.py'),[Text.Encoding]::UTF8)
    $records = ConvertFrom-Json -InputObject (Invoke-WslPython $code @($linux))
    foreach ($record in $records) { $record }
}
function Test-DeploymentInUse([string]$Deployment) {
    # Cleanup/uninstall must retain copies used by ANY tools or path consumers.
    return @(Get-DeploymentProcesses $Deployment).Count -gt 0
}
function Stop-DeploymentBlockers([string]$Deployment,[object[]]$Blockers) {
    foreach ($record in $Blockers | Where-Object { $_.platform -eq 'Windows' }) {
        $current = @(Get-WindowsDeploymentProcesses $Deployment | Where-Object { $_.pid -eq $record.pid -and $_.activationBlocker -and $_.startToken -eq $record.startToken })
        if ($current.Count -eq 0) { continue }
        $process = $null
        try {
            try { $process = [Diagnostics.Process]::GetProcessById($record.pid); [void]$process.Handle }
            catch [ArgumentException] { continue }
            if ($process.HasExited -or $process.StartTime.ToUniversalTime().ToString('yyyyMMddHHmmssffffff') -ne $record.startToken) { continue }
            Write-Host "ForceClose: stopping Windows $($record.name) (PID $($record.pid))."
            $process.Kill()
            if (-not $process.WaitForExit(5000)) { throw 'A blocking Windows process did not exit.' }
        } catch [ComponentModel.Win32Exception] {
            # Closing the parent app may already have ended this child between
            # the snapshot and handle acquisition. Do not hide access failures.
            if (-not (Get-Process -Id $record.pid -ErrorAction SilentlyContinue)) { continue }
            throw
        } catch [InvalidOperationException] {
            if ($process -and $process.HasExited) { continue }
            throw
        } finally { if ($process) { $process.Dispose() } }
    }
    $linux = @($Blockers | Where-Object { $_.platform -eq 'WSL' })
    if ($linux.Count -gt 0) {
        $code = [IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\tools\deployment-processes.py'),[Text.Encoding]::UTF8)
        $snapshot = ConvertTo-Json -InputObject $linux -Compress
        $stopped = ConvertFrom-Json -InputObject (Invoke-WslPython $code @((Get-WslPath $Deployment),'--terminate',$snapshot))
        foreach ($record in $stopped) { Write-Host "ForceClose: stopped WSL $($record.name) (PID $($record.pid))." }
    }
}
function Assert-DeploymentCanActivate([string]$Deployment,[string]$PreparedCopy,[switch]$ForceClose) {
    # Switching the stable pointer does not remove old files. Independent tools
    # may keep using their immutable copy; only the app/backend blocks activation.
    $blockers = @(Get-DeploymentProcesses $Deployment | Where-Object { $_.activationBlocker })
    if ($ForceClose -and $blockers.Count -gt 0) {
        Stop-DeploymentBlockers $Deployment $blockers
        $blockers = @(Get-DeploymentProcesses $Deployment | Where-Object { $_.activationBlocker })
    }
    if ($blockers.Count -gt 0) {
        $details = ($blockers | ForEach-Object { "$($_.platform) $($_.name) (PID $($_.pid))" }) -join ', '
        throw "A prior Codex app or backend is still running: $details. Close that app/backend normally and retry, or explicitly use install -ForceClose. Prepared copy: $PreparedCopy"
    }
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
