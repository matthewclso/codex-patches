[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$StockLinuxCli,
    [Parameter(Mandatory)][string]$StockDesktopExecutable,
    [Parameter(Mandatory)][string]$StockWindowsNode,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$NodeVersion = '24.16.0',
    [string]$Distribution = 'CodexPatches-CI-Ubuntu-26.04'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path $OutputDirectory).Path
$reportPath = Join-Path $OutputDirectory 'wsl.json'
$report = [ordered]@{
    schemaVersion = 1; observedAt = [DateTime]::UtcNow.ToString('o'); status = 'not-run'
    target = [ordered]@{ windows = 'Windows x64'; backend = 'Ubuntu 26.04 LTS'; wslVersion = 2 }
    host = [ordered]@{ os = [Environment]::OSVersion.VersionString; runnerImage = $env:ImageOS; runnerVersion = $env:ImageVersion }
    stages = @(); limitations = @('Authenticated desktop, browser UI, and phone reconnect require local acceptance.')
}
$imported = $false
function Save-Report {
    $report | ConvertTo-Json -Depth 12 | Set-Content $reportPath -Encoding utf8
}
function Invoke-Captured([string]$File, [string[]]$Arguments, [int]$TimeoutSeconds = 180) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $File; $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
    $finished = $process.WaitForExit($TimeoutSeconds * 1000)
    if (-not $finished) { $process.Kill($true); $process.WaitForExit() }
    $result = [ordered]@{ exitCode = $process.ExitCode; timedOut = -not $finished; output = (($stdout.GetAwaiter().GetResult() + $stderr.GetAwaiter().GetResult()) -replace "`0", '').Trim() }
    $process.Dispose()
    return $result
}
function Stage([string]$Name, $Result) {
    $report.stages += [ordered]@{ name = $Name; exitCode = $Result.exitCode; timedOut = $Result.timedOut; output = $Result.output }
    Save-Report
    Write-Host "$Name`: exit $($Result.exitCode)"
}
function Unsupported([string]$Reason) {
    $report.status = 'unsupported'; $report.reason = $Reason; Save-Report
    Write-Warning $Reason
}
function LinuxPath([string]$Path) {
    $result = Invoke-Captured 'wsl.exe' @('-d', $Distribution, '-u', 'root', '--exec', 'wslpath', '-a', '-u', $Path.Replace('\', '/'))
    if ($result.exitCode -ne 0) { throw "Cannot translate runner path into WSL: $($result.output)" }
    return $result.output
}
try {
    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Unsupported 'wsl.exe is absent from this hosted image.'; return }
    $cpu = Get-CimInstance Win32_Processor | Select-Object Name, VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions, VMMonitorModeExtensions
    $report.host.virtualization = @($cpu)
    $versionResult = Invoke-Captured 'wsl.exe' @('--version')
    Stage 'wsl-version' $versionResult
    $featureResults = @()
    foreach ($feature in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
        $state = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction Stop
        $featureResult = [ordered]@{ name = $feature; previous = [string]$state.State; requiredForWsl2 = $feature -eq 'VirtualMachinePlatform'; enabledForCi = $false; restartRequired = $false }
        # Modern WSL2 requires VirtualMachinePlatform. The inbox WSL optional
        # component is only necessary for WSL1; do not force a needless reboot.
        if ($state.State -ne 'Enabled' -and $feature -eq 'VirtualMachinePlatform') {
            $enable = Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart -ErrorAction Stop
            $featureResult.enabledForCi = $true; $featureResult.restartRequired = [bool]$enable.RestartNeeded
        }
        $featureResults += $featureResult
    }
    $report.host.features = $featureResults
    $report.host.hypervisorPresent = [bool](Get-CimInstance Win32_ComputerSystem).HypervisorPresent
    $report.host.services = @(Get-Service -Name vmcompute, WslService, LxssManager -ErrorAction SilentlyContinue | Select-Object Name, Status)
    Save-Report
    # Install/update the official WSL runtime, never silently fall back to WSL1.
    $update = Invoke-Captured 'wsl.exe' @('--update', '--web-download') 300
    Stage 'wsl-update' $update
    if ($update.exitCode -ne 0) { Unsupported 'The official WSL runtime could not initialize/update on this hosted image.'; return }
    $distributionIndex = Invoke-RestMethod 'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json'
    $ubuntu = @($distributionIndex.ModernDistributions.Ubuntu | Where-Object Name -eq 'Ubuntu-26.04')
    if ($ubuntu.Count -ne 1) { throw 'Official WSL index does not uniquely identify Ubuntu-26.04.' }
    $image = $ubuntu[0].Amd64Url
    $imageUri = [uri]$image.Url
    if ($imageUri.Scheme -ne 'https' -or $imageUri.Host -notin @('releases.ubuntu.com', 'cdimages.ubuntu.com', 'cloud-images.ubuntu.com')) { throw 'Ubuntu image source is outside Canonical distribution hosts.' }
    if ($image.Sha256 -notmatch '^[0-9a-fA-F]{64}$') { throw 'Ubuntu image checksum is missing from the official WSL index.' }
    $report.image = [ordered]@{ index = 'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json'; url = $image.Url; sha256 = $image.Sha256.ToLowerInvariant() }
    $imagePath = Join-Path $OutputDirectory 'ubuntu-26.04.wsl'
    Invoke-WebRequest -Uri $image.Url -OutFile $imagePath -TimeoutSec 600
    if ((Get-FileHash $imagePath -Algorithm SHA256).Hash -ne $image.Sha256) { throw 'Ubuntu WSL image checksum mismatch.' }
    $installPath = Join-Path $OutputDirectory 'distribution'
    $import = Invoke-Captured 'wsl.exe' @('--import', $Distribution, $installPath, $imagePath, '--version', '2') 300
    Stage 'wsl2-import' $import
    if ($import.exitCode -ne 0) { Unsupported 'WSL2 import failed. The hosted runner may not expose nested virtualization; consult the stage output.'; return }
    $imported = $true
    $boot = Invoke-Captured 'wsl.exe' @('-d', $Distribution, '-u', 'root', '--exec', 'sh', '-c', 'cat /etc/os-release; uname -r') 120
    Stage 'ubuntu-boot' $boot
    if ($boot.exitCode -ne 0) { Unsupported 'WSL2 guest could not boot on the hosted runner. This is not patch acceptance.'; return }
    if ($boot.output -notmatch 'VERSION_ID="26\.04"' -or $boot.output -notmatch '(?i)microsoft.*wsl2') { throw 'Booted guest did not identify as Ubuntu 26.04 on a WSL2 kernel.' }
    $linuxRepository = LinuxPath (Resolve-Path $Repository).Path
    $linuxCli = LinuxPath (Resolve-Path $StockLinuxCli).Path
    $linuxExe = LinuxPath (Resolve-Path $StockDesktopExecutable).Path
    $linuxWindowsNode = LinuxPath (Resolve-Path $StockWindowsNode).Path
    if ($NodeVersion -notmatch '^24\.\d+\.\d+$') { throw 'WSL tests require an exact Node 24 version.' }
    $nodeArchive = "node-v$NodeVersion-linux-x64.tar.xz"
    $nodeUrl = "https://nodejs.org/dist/v$NodeVersion"
    $bootstrap = "set -eu; apt-get update -qq; apt-get install -y --no-install-recommends ca-certificates curl xz-utils python3; cd /tmp; curl -fsSLo node.tar.xz '$nodeUrl/$nodeArchive'; curl -fsSLo SHASUMS256.txt '$nodeUrl/SHASUMS256.txt'; expected=`$(awk '/ $nodeArchive`$/ {print `$1}' SHASUMS256.txt); test -n `"`$expected`"; printf '%s  node.tar.xz\n' `"`$expected`" | sha256sum -c -; tar -xJf node.tar.xz -C /opt; /opt/node-v$NodeVersion-linux-x64/bin/node --version"
    $nodeSetup = Invoke-Captured 'wsl.exe' @('-d', $Distribution, '-u', 'root', '--exec', 'sh', '-c', $bootstrap) 300
    Stage 'node-setup' $nodeSetup
    if ($nodeSetup.exitCode -ne 0) { throw 'Verified Node runtime installation in WSL failed.' }
    # Paths are passed as positional arguments, not interpolated into shell source.
    $testScript = 'set -eu; export PATH="$1:$PATH"; cd "$2"; export CODEX_PATCHES_STOCK_LINUX_CLI="$3"; export CODEX_RELAY_TEST_BINARY="$3"; export CODEX_SOURCE_ASAR="$(dirname "$3")/app.asar"; export CODEX_PATCHES_TEST_ASAR="$CODEX_SOURCE_ASAR"; export CODEX_SOURCE_EXE="$5"; export CODEX_AUDIT_UNKNOWN=1; npm ci --ignore-scripts; npm test; node --test scripts/ci/*.test.cjs; node scripts/ci/probe-app-server.cjs --cli "$3" --out "$4"; node tools/audit-graphql.cjs "$CODEX_SOURCE_ASAR" "$7" "$6" > "$(dirname "$4")/graphql-windows-boundary.json"'
    $linuxReport = LinuxPath $OutputDirectory
    $tests = Invoke-Captured 'wsl.exe' @('-d', $Distribution, '-u', 'root', '--exec', 'sh', '-c', $testScript, 'ci-tests', "/opt/node-v$NodeVersion-linux-x64/bin", $linuxRepository, $linuxCli, "$linuxReport/app-server.json", $linuxExe, $linuxWindowsNode, $Distribution) 600
    Stage 'wsl-tests-and-stock-app-server' $tests
    if ($tests.exitCode -ne 0) { throw 'One or more WSL tests or stock app-server probes failed.' }
    $report.status = 'passed'; $report.reason = 'Ubuntu 26.04 WSL2 boot, repository tests, and stock app-server RPC probe passed.'
    Save-Report
} catch {
    $report.status = 'failed'; $report.reason = $_.Exception.Message; Save-Report
    Write-Error $_ -ErrorAction Continue
} finally {
    if ($imported) { [void](Invoke-Captured 'wsl.exe' @('--unregister', $Distribution) 120) }
    Save-Report
    if ($env:GITHUB_OUTPUT) { "status=$($report.status)" | Add-Content $env:GITHUB_OUTPUT -Encoding utf8 }
}
# The evidence gate reads this report and fails separately. Producing a report is never acceptance.
