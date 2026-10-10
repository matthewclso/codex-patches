'use strict';
// Retry only transient native request failures. Each attempt regenerates paths,
// feature selection and the managed native pipe; no durable pipe ID is embedded.
const syncBefore = 'function cc(e){let t=(rc.get(e.appServerConnection)??Promise.resolve()).catch(()=>{}).then(()=>lc(e));return rc.set(e.appServerConnection,t),t}';
const syncAfter = 'function cc(e){let t=(rc.get(e.appServerConnection)??Promise.resolve()).catch(()=>{}).then(async()=>{for(let t=0;;t++)try{return await lc(e)}catch(n){if(t>=2||!/timed out|expired while queued|app server.*(?:disconnected|not connected)/i.test(String(n?.message??n)))throw n;await new Promise(e=>setTimeout(e,1e3*(t+1)))}});return rc.set(e.appServerConnection,t),t}var __codexPatchesRuntimeRecovery=new WeakMap;function __codexPatchesRecoverRuntime(e){let t=__codexPatchesRuntimeRecovery.get(e.appServerConnection);if(t!=null&&t.reconcile===ic.get(e.appServerConnection)&&t.sync===rc.get(e.appServerConnection)&&t.features===K())return t.promise;let n=cc({...e,reloadUserConfig:!0}),r={promise:n,reconcile:ic.get(e.appServerConnection),sync:rc.get(e.appServerConnection),features:K()};return n.catch(()=>{__codexPatchesRuntimeRecovery.get(e.appServerConnection)===r&&__codexPatchesRuntimeRecovery.delete(e.appServerConnection)}),__codexPatchesRuntimeRecovery.set(e.appServerConnection,r),n}';
const resumeBefore = 'r=n?await oc(t):null,i=n?K():e.desktopFeatureAvailability';
const resumeAfter = 'r=n?(await oc(t)??await __codexPatchesRecoverRuntime(e).catch(()=>null)):null,i=n?K():e.desktopFeatureAvailability';
const failureBefore = 'throw gd().warning(`bundled_plugins_reconcile_failed`,{safe:{hasExternalPluginStateSync:l,reason:n},sensitive:{error:e}}),e';
const failureAfter = 'throw g===c&&(g=null),gd().warning(`bundled_plugins_reconcile_failed`,{safe:{hasExternalPluginStateSync:l,reason:n},sensitive:{error:e}}),e';
const focusBefore = 'reconcileExternalPluginState:(e=`focus`)=>N(e)';
const focusAfter = 'reconcileExternalPluginState:(e=`focus`)=>A({force:!1,reason:e}).then(()=>N(e))';
const reconcileBefore = 'S=m,w=g,C=!1,D(t.marketplacePluginDescriptors)};return{reconcileComputerHistoryPluginInstallation:';
const reconcileAfter = 'S=m,w=g,C=!1,D(t.marketplacePluginDescriptors);if(y.hadReconcileFailure)throw Error(`Bundled plugin reconciliation incomplete`)};return{reconcileComputerHistoryPluginInstallation:';
module.exports = {
  id: 'runtime-sync-recovery', title: 'Recover app-managed Browser and Computer Use configuration after startup failures',
  targetPath: '.vite/build/main-p91kJShj.js',
  sourceSha256: 'aafd6a750458cb39b6202f9be00231482122d32ac14017b79d544c4ab741e889',
  sourceType: 'commonjs',
  reconcileBefore, reconcileAfter, syncBefore, syncAfter, resumeBefore, resumeAfter, failureBefore, failureAfter, focusBefore, focusAfter,
  apply(source, replace) {
    for (const [before, after] of [[reconcileBefore,reconcileAfter],[syncBefore,syncAfter],[resumeBefore,resumeAfter],[failureBefore,failureAfter],[focusBefore,focusAfter]]) source = replace(source, before, after);
    return source;
  },
};

// Identifiers are mapped only inside the previously reviewed replacement text.
const currentNames = { cc: 'mc', rc: 'lc', lc: 'hc', ic: 'uc', oc: 'fc', gd: 'hf' };
const currentText = text => text.replace(/\b(?:cc|rc|lc|ic|oc|gd)\b/g, name => currentNames[name]);
const currentReplacements = [[reconcileBefore,reconcileAfter],[syncBefore,syncAfter],[resumeBefore,resumeAfter],[failureBefore,failureAfter],[focusBefore,focusAfter]].map(pair => pair.map(currentText));
module.exports.revisions = [{
  targetPath: '.vite/build/main-BklS_2Y2.js',
  sourceSha256: '5cf1544463be9497b85b69051aa5ad32320f9ebdca063ec2ab41abb75b6cadf7',
  reconcileBefore: currentText(reconcileBefore), reconcileAfter: currentText(reconcileAfter),
  syncBefore: currentText(syncBefore), syncAfter: currentText(syncAfter),
  resumeBefore: currentText(resumeBefore), resumeAfter: currentText(resumeAfter),
  failureBefore: currentText(failureBefore), failureAfter: currentText(failureAfter),
  focusBefore, focusAfter,
  apply(source, replace) {
    for (const [before, after] of currentReplacements) source = replace(source, before, after);
    return source;
  },
}];
