'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const request = JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const output = process.argv[3];
const wsl = path.join(process.env.WINDIR,'System32/wsl.exe');
const result = {success:false,providerRequests:0,isolatedState:true,nodeExecutable:process.execPath};
function exec(args,input) {
  const child=spawnSync(wsl,['-d',request.distro,'--exec',...args],{input,timeout:10000,windowsHide:true,encoding:'utf8'});
  if(child.status!==0) throw new Error('WSL preflight: '+(child.error?.message||child.stderr||child.stdout));
  return child.stdout.trim();
}
async function main() {
  let state;
  try {
    exec(['/usr/bin/true']);
    // No history, enrollment or credentials enter the probe. Disable relay and
    // remote control in its independent config while keeping the path adapter.
    const prepared=JSON.parse(exec(['/usr/bin/python3','-',request.runtimeConfig,request.deployment],`
import json,pathlib,sys,tempfile,os
config=json.loads(pathlib.Path(sys.argv[1]).read_text())
state=pathlib.Path(tempfile.mkdtemp(prefix='codex-patches-probe-'))
config.update(codexHome=str(state),sqliteHome=str(state/'sqlite'),relayEnabled=False)
(state/'config.toml').write_text('cli_auth_credentials_store = "file"\\n[analytics]\\nenabled = false\\n[feedback]\\nenabled = false\\n[features]\\nremote_control = false\\n')
p=state/'runtime.json';p.write_text(json.dumps(config));p.chmod(0o600)
print(json.dumps({'state':str(state),'config':str(p),'version':config['cliVersion'],'realCli':config['realCli']}))
`));
    state=prepared.state;
    const version=exec(['/usr/bin/env','CODEX_PATCHES_RUNTIME_CONFIG='+prepared.config,'codex-patches-proxy','--version']);
    if(version!==prepared.version) throw new Error('Proxy CLI version differs from the receipt');
    result.cliVersion=version;
    const child=spawn(wsl,['-d',request.distro,'--cd',state,'--exec','/usr/bin/env','CODEX_PATCHES_RUNTIME_CONFIG='+prepared.config,'codex-patches-proxy','-c','features.code_mode_host=true','app-server'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let pending='',stderr='',initialized=false;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{child.kill();reject(new Error('Isolated app-server initialization timed out'));},20000);
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.stdin.on('error',()=>{});
      child.stderr.on('data',chunk=>{if(stderr.length<8192) stderr+=chunk.toString();});
      child.stdout.on('data',chunk=>{
        pending+=chunk.toString();if(pending.length>1048576){child.kill();return;}
        let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);let message;try{message=JSON.parse(line);}catch{continue;}
          if(message.id!=='patches-probe'||initialized) continue;
          if(message.error){clearTimeout(timer);child.kill();reject(new Error('Initialize returned an error'));return;}
          initialized=true;result.returnedFields=Object.keys(message.result||{});
          child.stdin.end(JSON.stringify({jsonrpc:'2.0',method:'initialized',params:{}})+'\n');
        }
      });
      child.on('close',code=>{clearTimeout(timer);result.appServerExitCode=code;if(initialized&&code===0)resolve();else reject(new Error('Isolated app-server startup failed: '+stderr));});
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:'patches-probe',method:'initialize',params:{clientInfo:{name:'codex_patches_probe',version:'0.1.0'},capabilities:{experimentalApi:true}}})+'\n');
    });
    // Stock Windows CLI prechecks and the WSL proxy use the same exact version.
    const native=spawnSync(path.join(request.deployment,'bin/codex-patches-proxy.exe'),['--version'],{windowsHide:true,encoding:'utf8',timeout:7000});
    if(native.status!==0||native.stdout.trim()!==version)throw new Error('Windows and WSL CLI discovery disagree');
    const home=process.env.CODEX_HOME;
    if(home&&!fs.existsSync(path.resolve(home,'config.toml')))throw new Error('Windows cannot read shared config through CODEX_HOME');
    result.success=true;
  }catch(error){result.error=error.message;process.exitCode=1;}
  finally{if(state)try{exec(['/usr/bin/python3','-',state],"import shutil,sys;shutil.rmtree(sys.argv[1])\n");}catch{result.cleanupRequired=true;}}
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
}
main();
