function Get-CodexPackage {
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Windows x64 is required.' }
    $packages = @(Get-AppxPackage -Name OpenAI.Codex | Where-Object Architecture -eq 'X64' | Sort-Object Version -Descending)
    if ($packages.Count -eq 0) { throw 'Install the official Windows x64 Codex app first.' }
    $package = $packages[0]
    if ($package.Publisher -ne 'CN=50BDFD77-8903-4850-9FFE-6E8522F64D5B') { throw 'The installed package publisher has changed; compatibility review is required.' }
    $signature = Get-AuthenticodeSignature (Join-Path $package.InstallLocation 'app\ChatGPT.exe')
    if ($signature.Status -ne 'Valid') { throw 'The installed Codex executable does not have a valid signature.' }
    return $package
}
function Get-CodexNode($Package) { return (Join-Path $Package.InstallLocation 'app\resources\cua_node\bin\node.exe') }
function Write-JsonFile([string]$Path, $Value) {
    $parent = Split-Path $Path -Parent
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $temp = "$Path.$PID.tmp"
    [IO.File]::WriteAllText($temp, ($Value | ConvertTo-Json -Depth 30), [Text.UTF8Encoding]::new($false))
    if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temp, $Path, [NullString]::Value) }
    else { [IO.File]::Move($temp, $Path) }
}
function Read-JsonFile([string]$Path) { [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) | ConvertFrom-Json }
function Get-SelectionPath([string]$Requested, [string]$Root) {
    if ($Requested) { return (Resolve-Path -LiteralPath $Requested).Path }
    $saved = Join-Path $Root 'config.json'
    if (Test-Path -LiteralPath $saved) { return $saved }
    return (Join-Path $PSScriptRoot '..\config.example.json')
}
function Quote-NativeArgument([string]$Value) {
    # Windows CommandLineToArgvW quoting, including trailing slashes before quotes.
    if ($Value -notmatch '[\s"]' -and $Value.Length -gt 0) { return $Value }
    return '"' + ([regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1')) + '"'
}
function Invoke-Native([string]$Executable, [string[]]$Arguments, [string]$InputText = '', [int]$TimeoutSeconds = 300) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.Arguments = ($Arguments | ForEach-Object { Quote-NativeArgument $_ }) -join ' '
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true; $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::new(); $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw "Could not start $Executable" }
        $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
        if ($InputText) { $process.StandardInput.Write($InputText) }
        $process.StandardInput.Close()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) { $process.Kill(); throw "Command exceeded ${TimeoutSeconds}s: $Executable" }
        $out = $stdout.GetAwaiter().GetResult(); $err = $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw "Command failed ($($process.ExitCode)): $Executable`n$err`n$out" }
        return $out.Trim()
    } finally { $process.Dispose() }
}
function Invoke-Wsl([string[]]$Arguments, [string]$InputText = '', [switch]$RootUser) {
    $wslArguments = @('-d', $script:SelectedDistro)
    if ($RootUser) { $wslArguments += @('-u','root') }
    return Invoke-Native (Join-Path $env:WINDIR 'System32\wsl.exe') ($wslArguments + @('--exec') + $Arguments) $InputText
}
function Invoke-WslPython([string]$Code, [string[]]$Arguments = @(), [switch]$RootUser) {
    return Invoke-Wsl (@('/usr/bin/python3','-') + $Arguments) $Code -RootUser:$RootUser
}
function Get-WslPath([string]$WindowsPath) { return Invoke-Wsl @('/usr/bin/wslpath','-u',$WindowsPath) }
function Get-WindowsPath([string]$LinuxPath) { return Invoke-Wsl @('/usr/bin/wslpath','-w',$LinuxPath) }
function Set-PrivateDirectory([string]$Path) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [IO.Directory]::GetAccessControl($Path, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($existing in $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])) { [void]$acl.RemoveAccessRuleAll($existing) }
    foreach ($principal in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'), [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
        $acl.AddAccessRule($rule)
    }
    [IO.Directory]::SetAccessControl($Path, $acl)
}
function Get-Sha256File([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose(); $stream.Dispose() }
}
function Assert-Hash([string]$Path,[string]$Expected) {
    if ((Get-Sha256File $Path) -ne $Expected) { throw "Hash changed: $Path" }
}

function Assert-ToolkitSnapshot([string]$Deployment, $Receipt) {
    $root = Join-Path $Deployment 'toolkit'
    $actual = @(Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object { $_.FullName.Substring($root.Length+1).Replace('\','/') } | Sort-Object)
    $expected = @($Receipt.toolkitFiles | ForEach-Object { $_.path } | Sort-Object)
    if (@(Compare-Object $actual $expected).Count -gt 0) { throw 'Runtime source file set changed.' }
    foreach ($entry in $Receipt.toolkitFiles) { Assert-Hash (Join-Path $root $entry.path) $entry.outputSha256 }
}
