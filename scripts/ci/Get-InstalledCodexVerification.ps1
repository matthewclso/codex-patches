[CmdletBinding()]
param([Parameter(Mandatory)][string]$ExpectedPackageVersion)
$ErrorActionPreference = 'Stop'
$packages = @(Get-AppxPackage -Name OpenAI.Codex | Where-Object { $_.Version.ToString() -eq $ExpectedPackageVersion })
if ($packages.Count -ne 1) { throw 'Expected exactly one installed Codex package at the requested version.' }
$installed = $packages[0]
if ($installed.Publisher -ne 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B' -or
    $installed.Architecture.ToString() -ne 'X64' -or $installed.SignatureKind.ToString() -ne 'Store' -or
    $installed.Status.ToString() -ne 'Ok') { throw 'Installed package identity, signing kind or status failed verification.' }
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Management.Deployment.PackageManager,Windows.Management.Deployment,ContentType=WindowsRuntime]
$manager = New-Object Windows.Management.Deployment.PackageManager
$package = $manager.FindPackageForUser('', $installed.PackageFullName)
$operation = $package.VerifyContentIntegrityAsync()
$method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
    $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name.StartsWith('IAsyncOperation')
} | Select-Object -First 1
$task = $method.MakeGenericMethod([bool]).Invoke($null, @($operation))
$task.Wait()
if ($task.Result -ne $true) { throw 'Windows rejected installed package content integrity.' }
$signature = Get-AuthenticodeSignature (Join-Path $installed.InstallLocation 'app\ChatGPT.exe')
if ($signature.Status -ne 'Valid') { throw 'Installed executable signature is invalid.' }
[ordered]@{
    packageVersion = $installed.Version.ToString()
    msixSignature = 'not-run'
    publisher = 'matched-pin'
    executableSignature = 'valid'
    installedPackageSignature = 'Store'
    installedPackageStatus = 'Ok'
    installedPackageContentIntegrity = $true
} | ConvertTo-Json
