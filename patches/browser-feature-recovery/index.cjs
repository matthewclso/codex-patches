'use strict';
// Retain the last confirmed browser config feature during discovery errors.
// A first failed query stays pending; workspace policy and explicit false win.
const capabilityBefore = 'let i=t(f6,r),a=i.isError,o=i.isLoading||!a&&i.data==null,s=i.data?.find(e=>e.name===n.key);return{isLoading:o,isError:a,isCapable:!o&&!a&&s?.enabled!==!1}';
const capabilityAfter = 'let i=t(f6,r),a=i.isError,o=i.isLoading||!a&&i.data==null,s=i.data?.find(e=>e.name===n.key);if(e.name===`browser.in-app`&&a&&/timed out|expired while queued|app server.*(?:disconnected|not connected|connection.*closed)/i.test(String(i.error?.message??i.error)))return{isLoading:i.data==null,isError:a,isCapable:i.data!=null&&s?.enabled!==!1};return{isLoading:o,isError:a,isCapable:!o&&!a&&s?.enabled!==!1}';
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
