[CmdletBinding()]
param(
    [Parameter(Position=0)][ValidateSet('inspect','install','launch','doctor','stock','uninstall','repair-projects','cleanup')][string]$Command = 'inspect',
    [string]$Distro,
    [string]$CodexHome,
    [string]$SqliteHome,
    [string]$Config,
    [string]$InstallRoot = (Join-Path $env:USERPROFILE '.codex-patches'),
    [switch]$NoShortcut,
    [switch]$Apply,
    [string]$ImportRelayState
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\Common.ps1')
switch ($Command) {
    'inspect' { $package = Get-CodexPackage; $selectionPath = Get-SelectionPath $Config $InstallRoot; Invoke-Native (Get-CodexNode $package) @((Join-Path $PSScriptRoot 'bin\toolkit.cjs'),'inspect',"--source=$(Join-Path $package.InstallLocation 'app')","--config=$selectionPath") | Write-Host }
    'install' { . (Join-Path $PSScriptRoot 'scripts\Install.ps1'); Install-CodexPatches }
    'launch' { . (Join-Path $PSScriptRoot 'scripts\Launch.ps1'); Invoke-CodexPatchesLaunch -Launch }
    'doctor' { . (Join-Path $PSScriptRoot 'scripts\Launch.ps1'); Invoke-CodexPatchesLaunch }
    'stock' { Start-Process 'explorer.exe' "shell:AppsFolder\$((Get-CodexPackage).PackageFamilyName)!App" }
    'repair-projects' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Repair-CodexProjects }
    'cleanup' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Remove-OldDeployments }
    'uninstall' { . (Join-Path $PSScriptRoot 'scripts\Maintain.ps1'); Uninstall-CodexPatches }
}
