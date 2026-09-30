function Invoke-CodexPatchesLaunch([switch]$Launch) {
    $active = Read-JsonFile (Join-Path $InstallRoot 'active.json')
    if ($active.schemaVersion -ne 1) { throw 'Unsupported active installation.' }
    $deployment = $active.deployment
    if (-not ([IO.Path]::GetFullPath($deployment)).StartsWith(([IO.Path]::GetFullPath((Join-Path $InstallRoot 'versions')) + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Active deployment is outside the install directory.' }
    $install = Read-JsonFile (Join-Path $deployment 'install.json')
    Assert-Hash (Join-Path $deployment 'receipt.json') $install.receiptSha256
    $receipt = Read-JsonFile (Join-Path $deployment 'receipt.json')
    Assert-ToolkitSnapshot $deployment $receipt
    $package = Get-CodexPackage
    if ($package.PackageFullName -ne $receipt.packageFullName) { throw 'Codex was updated. Pull the repository and run install again before launching patches. The stock command remains available.' }
    Assert-Hash (Join-Path $package.InstallLocation 'app\resources\app.asar') $receipt.sourceArchiveSha256
    $node = Get-CodexNode $package
    Invoke-Native $node @((Join-Path $deployment 'toolkit\bin\toolkit.cjs'),'verify',"--directory=$deployment") | Write-Host
    Assert-Hash (Join-Path $deployment 'bin\codex-patches-proxy.exe') $install.nativeProxySha256
    if ($Launch -and @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count -gt 0) { throw 'Codex is running. Close it normally, then launch the patched shortcut.' }
    $requests = Join-Path $InstallRoot 'requests'
    Set-PrivateDirectory $requests
    $requestPath = Join-Path $requests "$([Guid]::NewGuid()).json"
    $resultPath = "$requestPath.result.json"
    $environment = @()
    foreach ($property in $install.environment.PSObject.Properties) {
        $value = [string]$property.Value
        if ($property.Name -eq 'PATH') { $value = "$(Join-Path $deployment 'bin');$env:PATH" }
        $environment += @{name=$property.Name;value=$value}
    }
    $request = @{schemaVersion=1;deployment=$deployment;receiptSha256=$install.receiptSha256;packageFullName=$package.PackageFullName;distro=$install.distro;runtimeConfig=$install.runtimeConfig;launch=[bool]$Launch;expiresAtUtc=[DateTime]::UtcNow.AddMinutes(2).ToString('o');environment=$environment}
    Write-JsonFile $requestPath $request
    $bridge = Join-Path $deployment 'toolkit\scripts\Invoke-PackageLaunch.ps1'
    $arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$bridge`" -RequestPath `"$requestPath`" -ResultPath `"$resultPath`""
    try {
        Invoke-CommandInDesktopPackage -PackageFamilyName $package.PackageFamilyName -AppId 'App' -Command (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -Args $arguments -PreventBreakaway | Out-Null
        $until = [DateTime]::UtcNow.AddSeconds(60)
        while (-not (Test-Path -LiteralPath $resultPath)) {
            if ([DateTime]::UtcNow -ge $until) { throw 'Package-context preflight timed out. No app was launched by this command.' }
            Start-Sleep -Milliseconds 250
        }
        $result = Read-JsonFile $resultPath
        Write-JsonFile (Join-Path $deployment 'last-doctor.json') $result
        if (-not $result.success) { throw $result.error }
        if ($Launch) { Write-Host "Launched patched Codex (PID $($result.processId))." }
        else { Write-Host 'Package identity, generated hashes and Windows-to-WSL app-server startup passed. Desktop UI and signed-binary-only actions require interactive verification.' }
    } finally {
        foreach ($file in @($requestPath,$resultPath,"$resultPath.runtime.json")) { Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue }
    }
}
