#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { identify, buildCopy, verifyCopy } = require('../lib/deployment.cjs');
const { resolveSelection } = require('../lib/selection.cjs');
function main(argv) {
  const [command,...args] = argv;
  const opts = Object.fromEntries(args.map(arg => { const at=arg.indexOf('='); if (!arg.startsWith('--')||at<3) throw new Error('Use --name=value arguments'); return [arg.slice(2,at),arg.slice(at+1)]; }));
  if(command==='inspect') { const {build}=identify(opts.source); return {build,selection:resolveSelection(JSON.parse(fs.readFileSync(opts.config,'utf8').replace(/^\uFEFF/,'')),build)}; }
  if(command==='build') return buildCopy({source:opts.source,destination:opts.destination,config:JSON.parse(fs.readFileSync(opts.config,'utf8').replace(/^\uFEFF/,'')),packageFullName:opts['package-full-name'],packageFamilyName:opts['package-family-name'],toolkitRoot:path.resolve(__dirname,'..')});
  if(command==='verify') { const {receipt,...report}=verifyCopy(opts.directory,{full:opts.full==='true'});return report; }
  throw new Error('Commands: inspect --source=... --config=...; build --source=... --destination=... --config=... --package-full-name=... --package-family-name=...; verify --directory=... [--full=true]');
}
module.exports={main};
if(require.main===module) {try {console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
