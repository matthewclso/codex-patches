'use strict';
// Retain the last confirmed browser config feature during discovery errors.
// A first failed query stays pending; workspace policy and explicit false win.
const capabilityBefore = 'let i=t(f6,r),a=i.isError,o=i.isLoading||!a&&i.data==null,s=i.data?.find(e=>e.name===n.key);return{isLoading:o,isError:a,isCapable:!o&&!a&&s?.enabled!==!1}';
const capabilityAfter = 'let i=t(f6,r),a=i.isError,o=i.isLoading||!a&&i.data==null,s=i.data?.find(e=>e.name===n.key);if(e.name===`browser.in-app`&&a&&!/unauthorized|forbidden|permission denied|access denied|not authorized|entitlement.*(?:denied|disabled)|(?:^|[^0-9])(?:401|403)(?:[^0-9]|$)/i.test(String(i.error?.message??i.error)))return{isLoading:i.data==null,isError:a,isCapable:i.data!=null&&s?.enabled!==!1};return{isLoading:o,isError:a,isCapable:!o&&!a&&s?.enabled!==!1}';
const pendingBefore = 'let o=Ik(Q8,a).isCapable,s=IU(`410262010`)';
const pendingAfter = 'let o=(()=>{let e=Ik(Q8,a);return e.isLoading?null:e.isCapable})(),s=IU(`410262010`)';
const requirementsBefore = 'y=i&&(!!u?.isLoading||m.isPending),b=!i||m.allowed';
const requirementsAfter = 'y=i&&(o===null||!!u?.isLoading||m.isPending),b=!i||m.allowed';
const policyBefore = 'return r.length===0?{isLoading:!1,isError:!1,isCapable:!0}:{isLoading:r.some(e=>e.isLoading),isError:r.some(e=>e.isError),isCapable:r.every(e=>e.isCapable)}';
const policyAfter = 'if(e.name===`browser.in-app`&&r.some(e=>!e.isLoading&&!e.isError&&!e.isCapable))return{isLoading:!1,isError:r.some(e=>e.isError),isCapable:!1};return r.length===0?{isLoading:!1,isError:!1,isCapable:!0}:{isLoading:r.some(e=>e.isLoading),isError:r.some(e=>e.isError),isCapable:r.every(e=>e.isCapable)}';
module.exports = {
  id: 'browser-feature-recovery', title: 'Preserve confirmed Browser availability during feature discovery failures',
  sourceType: 'module',
  targetPath: 'webview/assets/app-shared-40678a67f0e3.js',
  sourceSha256: '35b467c3a05695ec354eb1d0bb4572ad7e9d1480decc1cf0fae3d16b50aa5bd8',
  policyBefore, policyAfter, capabilityBefore, capabilityAfter, pendingBefore, pendingAfter, requirementsBefore, requirementsAfter,
  apply(source, replace) {
    source = replace(source, policyBefore, policyAfter);
    source = replace(source, capabilityBefore, capabilityAfter);
    source = replace(source, pendingBefore, pendingAfter);
    return replace(source, requirementsBefore, requirementsAfter);
  },
};

const currentCapabilityBefore = capabilityBefore.replace('t(f6,', 't(p6,');
const currentCapabilityAfter = capabilityAfter.replace('t(f6,', 't(p6,');
const currentPendingBefore = pendingBefore.replace('Ik(Q8,', 'pA($8,').replace('IU(', 'nW(');
const currentPendingAfter = pendingAfter.replace('Ik(Q8,', 'pA($8,').replace('IU(', 'nW(');
module.exports.revisions = [{
  targetPath: 'webview/assets/app-shared-737655e1fb23.js',
  sourceSha256: 'a1daa891e89a395b8db399ff6eaa365f12a86880c3d8cf891caf4ccbcb9eebf5',
  capabilityBefore: currentCapabilityBefore, capabilityAfter: currentCapabilityAfter,
  pendingBefore: currentPendingBefore, pendingAfter: currentPendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [currentCapabilityBefore, currentCapabilityAfter], [currentPendingBefore, currentPendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
}];

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-shared-30671c57ec82.js',
  sourceSha256: '392b023063a3569a2efc47a019accb2d1e72295b1bfec2cbb81fc37e1515580a',
});

const modernCapabilityBefore = capabilityBefore.replace('t(f6,', 't(Jh,');
const modernCapabilityAfter = capabilityAfter.replace('t(f6,', 't(Jh,');
const modernPendingBefore = pendingBefore.replace('Ik(Q8,', 'Eu(ty,').replace('IU(', 'Kv(');
const modernPendingAfter = pendingAfter.replace('Ik(Q8,', 'Eu(ty,').replace('IU(', 'Kv(');
module.exports.revisions.push({
  targetPath: 'webview/assets/app-initial-df84a35d942d.js',
  sourceSha256: 'd7659a96f7d0cfe2249e089ef19675d09d04d6dd9569b550ddaa64722d4f13f3',
  capabilityBefore: modernCapabilityBefore, capabilityAfter: modernCapabilityAfter,
  pendingBefore: modernPendingBefore, pendingAfter: modernPendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [modernCapabilityBefore, modernCapabilityAfter], [modernPendingBefore, modernPendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
});

module.exports.revisions.push({
  ...module.exports.revisions.at(-1),
  targetPath: 'webview/assets/app-initial-5851df3f6cb1.js',
  sourceSha256: 'c70d95da34ba7e5962a559dbf68d0102d10b4b47b877f5d9933629bb5a1f3a10',
});

const oct16CapabilityBefore = capabilityBefore.replace('t(f6,', 't(Eh,');
const oct16CapabilityAfter = capabilityAfter.replace('t(f6,', 't(Eh,');
const oct16PendingBefore = pendingBefore.replace('Ik(Q8,', 'Nc(sy,').replace('IU(', 'Qv(');
const oct16PendingAfter = pendingAfter.replace('Ik(Q8,', 'Nc(sy,').replace('IU(', 'Qv(');
module.exports.revisions.push({
  targetPath: 'webview/assets/app-initial-83973da15da9.js',
  sourceSha256: '1fb9718e75ae6b4adc0dfd030028d570846d098892e774564db5efe491ce4691',
  capabilityBefore: oct16CapabilityBefore, capabilityAfter: oct16CapabilityAfter,
  pendingBefore: oct16PendingBefore, pendingAfter: oct16PendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [oct16CapabilityBefore, oct16CapabilityAfter], [oct16PendingBefore, oct16PendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
});

const oct21CapabilityBefore = capabilityBefore.replace('t(f6,', 't(Hg,');
const oct21CapabilityAfter = capabilityAfter.replace('t(f6,', 't(Hg,');
const oct21PendingBefore = pendingBefore.replace('Ik(Q8,', 'ns(mx,').replace('IU(', 'ox(');
const oct21PendingAfter = pendingAfter.replace('Ik(Q8,', 'ns(mx,').replace('IU(', 'ox(');
module.exports.revisions.push({
  targetPath: 'webview/assets/app-initial-438d1df57f70.js',
  sourceSha256: 'd7b10b8bc54277eb3cb3a7a742c5b4c054a640530bbb7c1878e17097c0fc6d01',
  capabilityBefore: oct21CapabilityBefore, capabilityAfter: oct21CapabilityAfter,
  pendingBefore: oct21PendingBefore, pendingAfter: oct21PendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [oct21CapabilityBefore, oct21CapabilityAfter], [oct21PendingBefore, oct21PendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
});

const oct23CapabilityBefore = capabilityBefore.replace('t(f6,', 't(Tg,');
const oct23CapabilityAfter = capabilityAfter.replace('t(f6,', 't(Tg,');
const oct23PendingBefore = pendingBefore.replace('Ik(Q8,', 'An(fx,').replace('IU(', 'Xb(');
const oct23PendingAfter = pendingAfter.replace('Ik(Q8,', 'An(fx,').replace('IU(', 'Xb(');
module.exports.revisions.push({
  targetPath: "webview/assets/app-initial-db76c3384587.js",
  sourceSha256: '8511d0206f33dfd5bcc5f2a9d2273c9952f4844c9d79fdfb0404634d7a9d5723',
  capabilityBefore: oct23CapabilityBefore, capabilityAfter: oct23CapabilityAfter,
  pendingBefore: oct23PendingBefore, pendingAfter: oct23PendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [oct23CapabilityBefore, oct23CapabilityAfter], [oct23PendingBefore, oct23PendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
});

const oct27CapabilityBefore = capabilityBefore.replace('t(f6,', 't(pg,');
const oct27CapabilityAfter = capabilityAfter.replace('t(f6,', 't(pg,');
const oct27PendingBefore = pendingBefore.replace('Ik(Q8,', '_s(Gb,').replace('IU(', 'Mb(');
const oct27PendingAfter = pendingAfter.replace('Ik(Q8,', '_s(Gb,').replace('IU(', 'Mb(');
module.exports.revisions.push({
  targetPath: 'webview/assets/app-initial-4267e52fe5b0.js',
  sourceSha256: 'ba06de8c5418586b49ca7d639ea5ad2af531c1037454ec69b10b9ea11e00992e',
  capabilityBefore: oct27CapabilityBefore, capabilityAfter: oct27CapabilityAfter,
  pendingBefore: oct27PendingBefore, pendingAfter: oct27PendingAfter,
  apply(source, replace) {
    for (const [before, after] of [[policyBefore, policyAfter], [oct27CapabilityBefore, oct27CapabilityAfter], [oct27PendingBefore, oct27PendingAfter], [requirementsBefore, requirementsAfter]]) source = replace(source, before, after);
    return source;
  },
});
