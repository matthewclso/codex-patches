[CmdletBinding()]
param(
    [Parameter(Position=0)][ValidateSet('inspect','install','shortcut','launch','doctor','stock','uninstall','repair-projects','cleanup','cleanup-legacy')][string]$Command = 'inspect',
    [string]$Distro,
    [string]$CodexHome,
    [string]$SqliteHome,
    [string]$Config,
    [string]$InstallRoot = (Join-Path $env:USERPROFILE '.codex-patches'),
    [switch]$NoShortcut,
    [switch]$Apply,
    [string]$ImportRelayState,
    [string]$LegacyRoot = (Join-Path $env:USERPROFILE '.codex-wsl-launcher'),
    [string]$LegacyWrapper,
    [switch]$DesktopAccepted
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\Common.ps1')
switch ($Command) {
    'inspect' { $package = Get-CodexPackage; $selectionPath = Get-SelectionPath $Config $InstallRoot; Invoke-Native (Get-CodexNode $package) @((Join-Path $PSScriptRoot 'bin\toolkit.cjs'),'inspect',"--source=$(Join-Path $package.InstallLocation 'app')","--config=$selectionPath") | Write-Host }
    'install' { . (Join-Path $PSScriptRoot 'scripts\Install.ps1'); Install-CodexPatches }
    'shortcut' { . (Join-Path $PSScriptRoot 'scripts\Shortcut.ps1'); New-CodexPatchesShortcut }
    'launch' { . (Join-Path $PSScriptRoot 'scripts\Launch.ps1'); Invoke-CodexPatchesLaunch -Launch }
    'doctor' { . (Join-Path $PSScriptRoot 'scripts\Launch.ps1'); Invoke-CodexPatchesLaunch }
    'stock' { Start-Process 'explorer.exe' "shell:AppsFolder\$((Get-CodexPackage).PackageFamilyName)!App" }
    'repair-projects' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Repair-CodexProjects }
    'cleanup' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Remove-OldDeployments }
    'cleanup-legacy' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); . (Join-Path $PSScriptRoot 'scripts\Cleanup-Legacy.ps1'); Remove-LegacyPatches }
    'uninstall' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Uninstall-CodexPatches }
}
