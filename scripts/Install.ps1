function Install-CodexPatches {
    $package = Get-CodexPackage
    $node = Get-CodexNode $package
    $selectionPath = Get-SelectionPath $Config $InstallRoot
    $inspection = Invoke-Native $node @((Join-Path $PSScriptRoot '..\bin\toolkit.cjs'),'inspect',"--source=$(Join-Path $package.InstallLocation 'app')","--config=$selectionPath") | ConvertFrom-Json
    $script:SelectedDistro = $Distro
    if (-not $script:SelectedDistro) {
        # Let WSL select its configured default. The distro name is returned by WSL itself.
        $script:SelectedDistro = (Invoke-Native (Join-Path $env:WINDIR 'System32\wsl.exe') @('--exec','/usr/bin/printenv','WSL_DISTRO_NAME'))
    }
    $facts = Invoke-WslPython @'
import json,os,pathlib,platform
release={}
for line in pathlib.Path('/etc/os-release').read_text().splitlines():
 if '=' in line:
  k,v=line.split('=',1);release[k]=v.strip('"')
if release.get('ID')!='ubuntu' or release.get('VERSION_ID')!='26.04': raise SystemExit('Ubuntu 26.04 LTS is required')
if 'WSL2' not in platform.release(): raise SystemExit('WSL2 is required')
home=str(pathlib.Path.home())
print(json.dumps({'home':home,'stateRoot':home+'/.local/share/codex-patches','sqliteHome':home+'/.codex/sqlite','release':release['PRETTY_NAME']}))
'@ | ConvertFrom-Json
    if (-not $CodexHome) {
        $CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $CodexHome 'config.toml'))) { throw 'CodexHome must contain the existing Codex config.toml.' }
    $CodexHome = (Resolve-Path -LiteralPath $CodexHome).Path
    $toml = [IO.File]::ReadAllText((Join-Path $CodexHome 'config.toml'), [Text.Encoding]::UTF8)
    if ($toml -notmatch '(?m)^\s*runCodexInWindowsSubsystemForLinux\s*=\s*true\s*$') { throw 'Select the WSL backend in Codex settings before installing.' }
    if (-not $SqliteHome) { $SqliteHome = $facts.sqliteHome }
    if (-not $SqliteHome.StartsWith('/')) { throw 'SqliteHome must be an absolute Linux path.' }
    Set-PrivateDirectory $InstallRoot
    $InstallRoot = (Resolve-Path -LiteralPath $InstallRoot).Path
    $stateRoot = $facts.stateRoot
    Invoke-WslPython @'
import os,pathlib,sys
p=pathlib.Path(sys.argv[1])
if p.is_symlink(): raise SystemExit('State root cannot be a symlink')
p.mkdir(parents=True,exist_ok=True);p.chmod(0o700)
'@ @($stateRoot) | Out-Null
    # Provision only within toolkit-owned directories, with a reviewed checksum.
    $tools = Read-JsonFile (Join-Path $PSScriptRoot '..\compatibility\tools.json')
    $linuxNodeDirectory = "$stateRoot/tools/node-v$($tools.nodeVersion)-linux-x64"
    $linuxNode = "$linuxNodeDirectory/bin/node"
    $installed = Invoke-WslPython 'import os,sys;print(int(os.path.isfile(sys.argv[1])))' @($linuxNode)
    if ($installed -ne '1') {
        $downloads = Join-Path $InstallRoot 'downloads'
        New-Item -ItemType Directory -Path $downloads -Force | Out-Null
        $archive = Join-Path $downloads "node-v$($tools.nodeVersion)-linux-x64.tar.xz"
        Invoke-WebRequest -UseBasicParsing -Uri $tools.linuxNodeUrl -OutFile $archive
        Assert-Hash $archive $tools.linuxNodeSha256
        $archiveLinux = Get-WslPath $archive
        Invoke-WslPython @'
import pathlib,sys,tarfile
root=pathlib.Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
with tarfile.open(sys.argv[1]) as t:t.extractall(root,filter='data')
'@ @($archiveLinux,"$stateRoot/tools") | Out-Null
    }
    $nodeVersion = Invoke-Wsl @($linuxNode,'--version')
    if ($nodeVersion -ne "v$($tools.nodeVersion)") { throw 'Provisioned Node version changed.' }
    $repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $repoLinux = Get-WslPath $repo
    # npm is part of the pinned Node distribution. ws has no native build or install scripts.
    Invoke-WslPython @'
import os,subprocess,sys
os.chdir(sys.argv[1]);subprocess.run([sys.argv[2],sys.argv[3],'ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],check=True)
'@ @($repoLinux,$linuxNode,"$linuxNodeDirectory/lib/node_modules/npm/bin/npm-cli.js") | Write-Host
    $versions = Join-Path $InstallRoot 'versions'
    New-Item -ItemType Directory -Path $versions -Force | Out-Null
    $id = "$($package.Version)-$([Guid]::NewGuid().ToString('N').Substring(0,12))"
    $deployment = Join-Path $versions $id
    Write-Host "Building an independent app copy for $($package.Version)..."
    Invoke-Native $node @((Join-Path $repo 'bin\toolkit.cjs'),'build',"--source=$(Join-Path $package.InstallLocation 'app')","--destination=$deployment","--config=$selectionPath","--package-full-name=$($package.PackageFullName)","--package-family-name=$($package.PackageFamilyName)") | Out-Null
    $receipt = Read-JsonFile (Join-Path $deployment 'receipt.json')
    $selected = @($receipt.selection.selected)
    $deploymentLinux = Get-WslPath $deployment
    # The native shim is used for Windows-side version discovery; the same bare
    # command resolves to the Python supervisor in the WSL login PATH.
    $bin = Join-Path $deployment 'bin'
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $deployment 'app\resources\codex.exe') -Destination (Join-Path $bin 'codex-patches-proxy.exe')
    $runtimeConfigPath = "$stateRoot/deployments/$id/runtime.json"
    $runtime = [ordered]@{schemaVersion=1;realCli="$deploymentLinux/app/resources/codex";cliSha256=$inspection.build.cliLinuxSha256;cliVersion="codex-cli $($receipt.cliVersion)";codexHome=(Get-WslPath $CodexHome);sqliteHome=$SqliteHome;stateRoot=$stateRoot;distro=$script:SelectedDistro;relayEnabled=($selected -contains 'remote-fast-list');rewriteProjectPaths=($selected -contains 'wsl-project-paths');node=$linuxNode}
    $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($runtime | ConvertTo-Json -Depth 8)))
    Invoke-WslPython @'
import base64,os,pathlib,sys
p=pathlib.Path(sys.argv[1]);p.parent.mkdir(parents=True,exist_ok=True);p.parent.chmod(0o700)
if p.exists():raise SystemExit('Deployment runtime already exists')
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'wb') as f:f.write(base64.b64decode(sys.argv[2]))
for name in ('codex','codex-code-mode-host'):pathlib.Path(sys.argv[3]+'/app/resources/'+name).chmod(0o755)
pathlib.Path(sys.argv[3]+'/toolkit/patches/wsl-project-paths/proxy.py').chmod(0o755)
'@ @($runtimeConfigPath,$payload,$deploymentLinux) | Out-Null
    if ($ImportRelayState) {
        if (-not $runtime.relayEnabled) { throw 'Relay state import requires remote-fast-list.' }
        Invoke-WslPython @'
import json,os,pathlib,shutil,sys
source=pathlib.Path(sys.argv[1]);target=pathlib.Path(sys.argv[2])/'relay/runtime.json'
if source.is_symlink() or source.stat().st_uid!=os.getuid() or source.stat().st_mode&0o077:raise SystemExit('Import must be a private owned relay state file')
value=json.loads(source.read_text())
if value.get('version')!=1 or not isinstance(value.get('port'),int) or not isinstance(value.get('capability'),str):raise SystemExit('Unsupported relay state')
target.parent.mkdir(parents=True,exist_ok=True);target.parent.chmod(0o700)
if target.exists():
 current=json.loads(target.read_text())
 if any(current.get(k)!=value[k] for k in ('version','port','capability')):raise SystemExit('A different relay route already exists')
else:
 fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump({k:value[k] for k in ('version','port','capability')},f)
print('Existing relay route preserved; capability was not displayed.')
'@ @($ImportRelayState,$stateRoot) | Write-Host
    }
    $proxy = "$deploymentLinux/toolkit/patches/wsl-project-paths/proxy.py"
    # Stable symlink only; no modifications to global shell initialization.
    $ownedJunctions = @()
    $homeValue = $CodexHome
    $environment = [ordered]@{CODEX_HOME=$homeValue;CODEX_PATCHES_RUNTIME_CONFIG=$runtimeConfigPath;CODEX_CLI_PATH='codex-patches-proxy';PATH="$bin;$env:PATH"}
    $passNames = @('CODEX_PATCHES_RUNTIME_CONFIG','CODEX_HOME')
    $kept = @($env:WSLENV -split ':' | Where-Object { $_ -and (($_ -split '/',2)[0]) -notin $passNames })
    $environment.WSLENV = (@($kept) + @($passNames | ForEach-Object { "$_/u" })) -join ':'
    $install = [ordered]@{schemaVersion=1;id=$id;deployment=$deployment;distro=$script:SelectedDistro;runtimeConfig=$runtimeConfigPath;stateRoot=$stateRoot;environment=$environment;ownedJunctions=$ownedJunctions;proxy=@{link='/usr/local/bin/codex-patches-proxy';target=$proxy};receiptSha256=(Get-FileHash (Join-Path $deployment 'receipt.json') -Algorithm SHA256).Hash.ToLowerInvariant();nativeProxySha256=$inspection.build.cliWindowsSha256}
    Write-JsonFile (Join-Path $deployment 'install.json') $install
    # Validate the full generated copy before any account routing or activation.
    Invoke-Native $node @((Join-Path $deployment 'toolkit\bin\toolkit.cjs'),'verify',"--directory=$deployment",'--full=true') | Write-Host
    if ($runtime.relayEnabled) {
        Invoke-Wsl @($linuxNode,"$deploymentLinux/toolkit/patches/remote-fast-list/configure.cjs","--config=$runtimeConfigPath",'--apply') | Write-Host
    }
    if ([IO.Path]::GetFullPath($selectionPath) -ne [IO.Path]::GetFullPath((Join-Path $InstallRoot 'config.json'))) {
        Copy-Item -LiteralPath $selectionPath -Destination (Join-Path $InstallRoot 'config.json') -Force
    }
    . (Join-Path $PSScriptRoot 'Maintain.ps1')
    foreach ($oldDirectory in Get-ChildItem -LiteralPath $versions -Directory) {
        if ($oldDirectory.FullName -ne $deployment -and (Test-DeploymentInUse $oldDirectory.FullName)) { throw "A prior toolkit deployment is in use. Close patched Codex normally and retry installation. Prepared copy: $deployment" }
    }
    $linkReport = Invoke-WslPython @'
import json,os,pathlib,sys
p=pathlib.Path('/usr/local/bin/codex-patches-proxy');target=sys.argv[1];owner=pathlib.Path('/usr/local/share/codex-patches-owner.json')
uid=int(sys.argv[2])
if p.exists() or p.is_symlink():
 if not p.is_symlink() or not owner.exists():raise SystemExit('Existing proxy command is not owned by this toolkit')
 record=json.loads(owner.read_text())
 if record.get('uid')!=uid or os.readlink(p)!=record.get('target'):raise SystemExit('Existing proxy ownership does not match')
temporary=p.with_name('.codex-patches-proxy-'+str(os.getpid()))
os.symlink(target,temporary);os.replace(temporary,p);owner.write_text(json.dumps({'uid':uid,'target':target})+'\n');owner.chmod(0o644)
print(json.dumps({'link':str(p),'target':target}))
'@ @($proxy,(Invoke-Wsl @('/usr/bin/id','-u'))) -RootUser | ConvertFrom-Json
    # Pointer changes atomically only after build verification and runtime configuration.
    Write-JsonFile (Join-Path $InstallRoot 'active.json') @{schemaVersion=1;deployment=$deployment;id=$id}
    $bootstrap = @'
param([string]$InstallRoot = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
$active = [IO.File]::ReadAllText((Join-Path $InstallRoot 'active.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
& (Join-Path $active.deployment 'toolkit\codex-patches.ps1') launch -InstallRoot $InstallRoot
'@
    [IO.File]::WriteAllText((Join-Path $InstallRoot 'launch.ps1'), $bootstrap, [Text.UTF8Encoding]::new($false))
    if (-not $NoShortcut) {
        $shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex - Patched.lnk'
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $shortcut.Arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $InstallRoot 'launch.ps1')`" -InstallRoot `"$InstallRoot`""
        $shortcut.WorkingDirectory = $InstallRoot
        $shortcut.IconLocation = "$(Join-Path $deployment 'app\ChatGPT.exe'),0"
        $shortcut.Description = 'Codex with the selected Windows/WSL compatibility patches'
        $shortcut.Save()
        Write-JsonFile (Join-Path $InstallRoot 'shortcut.json') @{path=$shortcutPath;target=$shortcut.TargetPath;arguments=$shortcut.Arguments}
    }
    Write-Host "Installed $id. Run .\codex-patches.ps1 doctor to validate package-context WSL startup, then close Codex and use Codex - Patched."
}
