[CmdletBinding()]
param([Parameter(Mandatory)][string]$RequestPath, [Parameter(Mandatory)][string]$ResultPath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$result = @{success=$false;launchPerformed=$false;providerRequests=0}
try {
    $request = Read-JsonFile $RequestPath
    if ($request.schemaVersion -ne 1 -or [DateTime]::UtcNow -ge [DateTime]::Parse($request.expiresAtUtc).ToUniversalTime()) { throw 'Invalid or expired package launch request.' }
    Assert-Hash (Join-Path $request.deployment 'receipt.json') $request.receiptSha256
    $receipt = Read-JsonFile (Join-Path $request.deployment 'receipt.json')
    Assert-ToolkitSnapshot $request.deployment $receipt
    if ($receipt.packageFullName -ne $request.packageFullName) { throw 'Launch request package differs from its receipt.' }
    Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class CodexPatchesIdentity {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] public static extern int GetCurrentPackageFullName(ref uint length,StringBuilder name);
}
'@
    $length = [uint32]0
    $status = [CodexPatchesIdentity]::GetCurrentPackageFullName([ref]$length,$null)
    if ($status -ne 122) { throw "Desktop package identity is missing ($status)." }
    $name = [Text.StringBuilder]::new([int]$length)
    if ([CodexPatchesIdentity]::GetCurrentPackageFullName([ref]$length,$name) -ne 0 -or $name.ToString() -ne $receipt.packageFullName) { throw 'Unexpected desktop package context.' }
    $result.packageFullName = $name.ToString()
    $allowed = @('CODEX_HOME','CODEX_PATCHES_RUNTIME_CONFIG','CODEX_CLI_PATH','PATH','WSLENV')
    foreach ($entry in $request.environment) {
        if ($allowed -notcontains $entry.name) { throw "Unexpected process environment key: $($entry.name)" }
        [Environment]::SetEnvironmentVariable($entry.name,$entry.value,'Process')
    }
    foreach ($key in @('NODE_OPTIONS','CODEX_NODE_REPL_PATH','CODEX_PET_DRAG_FIX_ENABLED','CODEX_WSL_BROWSER_FIX_ENABLED')) {
        if ([Environment]::GetEnvironmentVariable($key,'Process')) { throw "Legacy injection override is active: $key" }
    }
    $node = Join-Path $request.deployment 'app\resources\cua_node\bin\node.exe'
    Invoke-Native $node @((Join-Path $request.deployment 'toolkit\bin\toolkit.cjs'),'verify',"--directory=$($request.deployment)") | Out-Null
    $runtimeFile = "$ResultPath.runtime.json"
    Invoke-Native $node @((Join-Path $PSScriptRoot 'runtime-probe.cjs'),$RequestPath,$runtimeFile) '' 40 | Out-Null
    $result.runtime = Read-JsonFile $runtimeFile
    if (-not $result.runtime.success) { throw $result.runtime.error }
    if ($request.launch) {
        if ([DateTime]::UtcNow -ge [DateTime]::Parse($request.expiresAtUtc).ToUniversalTime()) { throw 'Launch request expired during preflight.' }
        if (@(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Codex is already running; close it normally first.' }
        $app = Join-Path $request.deployment 'app'
        $process = Start-Process -FilePath (Join-Path $app $receipt.executableRelativePath) -WorkingDirectory $app -PassThru
        $null = $process.Handle
        if ($process.WaitForExit(5000)) { throw "Copied app exited during startup ($($process.ExitCode))." }
        $result.processId = $process.Id; $result.launchPerformed = $true
    }
    $result.success = $true
} catch { $result.error = $_.Exception.Message }
Write-JsonFile $ResultPath $result
