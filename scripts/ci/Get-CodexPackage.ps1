[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$ExpectedPublisher = 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$documentationUrl = 'https://learn.chatgpt.com/docs/enterprise/windows-deployment'
$officialPackageUrl = 'https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path
$packagePath = Join-Path $OutputDirectory 'Codex-x64.msix'
$extractPath = Join-Path $OutputDirectory 'stock'
$reportPath = Join-Path $OutputDirectory 'package.json'
# A fixed documented URL is intentional. An unexpected redirect or publisher is a review event.
$response = Invoke-WebRequest -Uri $officialPackageUrl -OutFile $packagePath -PassThru -TimeoutSec 600
$resolvedUrl = $response.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
if ([uri]$resolvedUrl -and ([uri]$resolvedUrl).Host -ne 'persistent.oaistatic.com') {
    throw "Package download redirected outside the official distribution host: $resolvedUrl"
}
$signatureTools = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending
if (-not $signatureTools) { throw 'Windows SDK signtool.exe is required to verify the MSIX signature.' }
$signatureTool = $signatureTools[0].FullName
$signatureOutput = & $signatureTool verify /pa /all /v $packagePath 2>&1
$signatureOutput | Set-Content (Join-Path $OutputDirectory 'msix-signature.txt') -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'Official MSIX did not pass Windows SDK signature verification.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($packagePath, $extractPath)
[xml]$manifest = Get-Content (Join-Path $extractPath 'AppxManifest.xml') -Raw
$identity = $manifest.Package.Identity
if ($identity.Name -ne 'OpenAI.Codex') { throw "Unexpected package identity: $($identity.Name)" }
if ($identity.ProcessorArchitecture -ne 'x64') { throw "Unexpected architecture: $($identity.ProcessorArchitecture)" }
if ($identity.Publisher -ne $ExpectedPublisher) { throw "Publisher changed. Review the officially signed package before updating the publisher pin: $($identity.Publisher)" }
$archivePaths = @(Get-ChildItem -Path $extractPath -Filter app.asar -Recurse | Where-Object { $_.Directory.Name -eq 'resources' })
if ($archivePaths.Count -ne 1) { throw "Expected exactly one application archive, found $($archivePaths.Count)." }
$appDirectory = $archivePaths[0].Directory.Parent.FullName
$applicationExecutables = @($manifest.Package.Applications.Application | ForEach-Object { [string]$_.Executable } | Where-Object { $_ })
$executableCandidates = @($applicationExecutables | ForEach-Object { Join-Path $extractPath $_ } | Where-Object { (Test-Path $_) -and (Split-Path $_ -Parent) -eq $appDirectory } | Select-Object -Unique)
if ($executableCandidates.Count -ne 1) { throw 'The package manifest does not identify exactly one desktop executable beside resources.' }
$executable = $executableCandidates[0]
$exeSignature = Get-AuthenticodeSignature $executable
if ($exeSignature.Status -ne 'Valid') { throw "Stock executable signature is invalid: $($exeSignature.Status)" }
$windowsCli = Join-Path $appDirectory 'resources\codex.exe'
$linuxCli = Join-Path $appDirectory 'resources\codex'
$linuxCodeMode = Join-Path $appDirectory 'resources\codex-code-mode-host'
$windowsCodeMode = Join-Path $appDirectory 'resources\codex-code-mode-host.exe'
$windowsNode = Join-Path $appDirectory 'resources\cua_node\bin\node.exe'
foreach ($runtimeFile in @($windowsCli, $linuxCli, $linuxCodeMode, $windowsCodeMode, $windowsNode)) {
    if (-not (Test-Path $runtimeFile)) { throw "The official package is missing a stock CLI/Code Mode runtime: $runtimeFile" }
}
$cliOutput = (& $windowsCli --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $cliOutput -notmatch '(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)') { throw 'Unable to establish bundled stock CLI version.' }
$cliVersion = $Matches.version
$appVersion = (& node (Join-Path $PSScriptRoot 'inspect-app-version.cjs') $archivePaths[0].FullName | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $appVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Unable to establish internal Codex app version from its archive.' }
$report = [ordered]@{
    schemaVersion = 1
    observedAt = [DateTime]::UtcNow.ToString('o')
    source = [ordered]@{ documentationUrl = $documentationUrl; downloadUrl = $officialPackageUrl; finalUrl = $resolvedUrl }
    identity = [ordered]@{ name = [string]$identity.Name; packageVersion = [string]$identity.Version; architecture = [string]$identity.ProcessorArchitecture; publisher = [string]$identity.Publisher }
    hashes = [ordered]@{
        msixSha256 = (Get-FileHash $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        archiveSha256 = (Get-FileHash $archivePaths[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        executableSha256 = (Get-FileHash $executable -Algorithm SHA256).Hash.ToLowerInvariant()
        cliLinuxSha256 = (Get-FileHash $linuxCli -Algorithm SHA256).Hash.ToLowerInvariant()
        cliWindowsSha256 = (Get-FileHash $windowsCli -Algorithm SHA256).Hash.ToLowerInvariant()
        codeModeLinuxSha256 = (Get-FileHash $linuxCodeMode -Algorithm SHA256).Hash.ToLowerInvariant()
        codeModeWindowsSha256 = (Get-FileHash $windowsCodeMode -Algorithm SHA256).Hash.ToLowerInvariant()
        nodeWindowsSha256 = (Get-FileHash $windowsNode -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    versions = [ordered]@{ cliVersion = $cliVersion; appVersion = $appVersion }
    files = [ordered]@{ executableRelativePath = [IO.Path]::GetRelativePath($appDirectory, $executable) }
    verification = [ordered]@{ msixSignature = 'valid'; executableSignature = 'valid'; identity = 'verified'; publisher = 'matched-pin'; architecture = 'x64' }
}
$report | ConvertTo-Json -Depth 8 | Set-Content $reportPath -Encoding utf8
if ($env:GITHUB_OUTPUT) {
    "app_directory=$appDirectory" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
    "package_report=$reportPath" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
    "package_version=$($identity.Version)" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
    "linux_cli=$linuxCli" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
    "stock_executable=$executable" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
    "stock_windows_node=$windowsNode" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8
}
Write-Host "Verified official OpenAI.Codex $($identity.Version), bundled CLI $cliVersion"
