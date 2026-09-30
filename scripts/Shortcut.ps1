function New-CodexPatchesShortcut {
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
    $activePath = Join-Path $InstallRoot 'active.json'
    $launcher = Join-Path $InstallRoot 'launch.ps1'
    if (-not (Test-Path -LiteralPath $activePath -PathType Leaf) -or -not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
        throw 'Run install before creating the desktop shortcut.'
    }
    $active = Read-JsonFile $activePath
    $deployment = [IO.Path]::GetFullPath($active.deployment)
    $versions = [IO.Path]::GetFullPath((Join-Path $InstallRoot 'versions')) + '\'
    if ($active.schemaVersion -ne 1 -or -not $deployment.StartsWith($versions, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Active deployment is outside the install directory or has an unsupported schema.'
    }
    $install = Read-JsonFile (Join-Path $deployment 'install.json')
    $receiptPath = Join-Path $deployment 'receipt.json'
    Assert-Hash $receiptPath $install.receiptSha256
    $receipt = Read-JsonFile $receiptPath
    $appRoot = [IO.Path]::GetFullPath((Join-Path $deployment 'app')) + '\'
    $icon = [IO.Path]::GetFullPath((Join-Path $appRoot $receipt.executableRelativePath))
    if ($receipt.schemaVersion -ne 1 -or -not $icon.StartsWith($appRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid app executable in installation receipt.' }
    if (-not (Test-Path -LiteralPath $icon -PathType Leaf)) { throw 'Active app copy is missing. Run install before creating the shortcut.' }
    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex - Patched.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shortcutArguments = @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',$launcher,'-InstallRoot',$InstallRoot)
    $shortcut.Arguments = ($shortcutArguments | ForEach-Object { Quote-NativeArgument $_ }) -join ' '
    $shortcut.WorkingDirectory = $InstallRoot
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Description = 'Codex with the selected Windows/WSL compatibility patches'
    $shortcut.Save()
    Write-JsonFile (Join-Path $InstallRoot 'shortcut.json') @{path=$shortcutPath;target=$shortcut.TargetPath;arguments=$shortcut.Arguments}
    Write-Host "Created desktop shortcut: $shortcutPath"
}
