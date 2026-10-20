// Optional identity is supplied by the server page. Cached state is scoped to that stable identity.
let portalIdentity=null;
try{portalIdentity=JSON.parse(document.getElementById('portal-identity')?.textContent||'null');}catch(e){}
const portalStorageKey=portalIdentity?'inspired-account:'+portalIdentity.id:'inspired-guest-v2';
let portalCache=null,portalLegacy=null,portalRemote=null,portalGuest=null;
try{portalCache=JSON.parse(localStorage.getItem(portalStorageKey)||'null');if(portalIdentity?.role==='Admin'&&!portalCache)portalLegacy=JSON.parse(localStorage.getItem('inspired-portal-v1')||'null');}catch(e){}
if(portalIdentity&&new URLSearchParams(window.location.search).get('import')==='guest'){try{portalGuest=JSON.parse(localStorage.getItem('inspired-guest-v2')||'null');window.history.replaceState(null,'',window.location.pathname+window.location.hash);}catch(e){}}
if(portalIdentity){try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch('/api/progress',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(response.ok)portalRemote=await response.json();}finally{clearTimeout(timer);}}catch(e){}}
let portalModulesBoot=null;try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch('/api/modules',{credentials:'omit',cache:'no-store',signal:controller.signal});if(response.ok)portalModulesBoot=await response.json();}finally{clearTimeout(timer);}}catch{}
window.__PORTAL_BOOT__={modules:portalModulesBoot,user:portalIdentity,storageKey:portalStorageKey,cache:portalCache,legacy:portalLegacy,remote:portalRemote,guest:portalGuest};
