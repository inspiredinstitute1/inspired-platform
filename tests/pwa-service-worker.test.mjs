import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const events={},data=new Map(),deleted=[];let offline=false,privateAsset=false,claimed=false;
const cache={async put(key,response){data.set(String(key),response.clone())},async match(key){return data.get(String(key))?.clone()}};
const context={URL,Request,Response,Set,self:{location:{origin:'https://portal.test'},addEventListener:(name,handler)=>events[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true}}},caches:{open:async()=>cache,keys:async()=>['inspired-cache-v2','inspired-public-obsolete','inspired-public-v1','another-app'],delete:async name=>{deleted.push(name);return true}},fetch:async request=>{if(offline)throw new Error('Offline');const path=new URL(request.url).pathname;return new Response(path==='/offline.html'?'Neutral offline page':path==='/'?'Private signed-in HTML':'Public asset',{headers:{'Cache-Control':path==='/'||privateAsset?'private, no-store':'public, max-age=3600'}})}};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
let pending;events.install({waitUntil:p=>pending=p});await pending;
assert(data.has('/offline.html'));assert(data.has('/assets/notes/100-important-homophones.pdf'));assert(!data.has('/'));assert(![...data.keys()].some(k=>k.includes('/api/')));
events.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['inspired-cache-v2','inspired-public-obsolete']);assert(claimed);
async function request(path,options={}){let response;events.fetch({request:{url:'https://portal.test'+path,method:'GET',mode:'cors',headers:new Headers(),...options},respondWith:p=>response=p});return response?await response:null}
for(const path of ['/api/progress','/api/admin/learning','/signin-with-chatgpt?return_to=%2F','/signout-with-chatgpt','/callback?code=sensitive'])assert.equal(await request(path,{mode:'navigate'}),null);
assert.equal(await request('/theme.css',{method:'POST'}),null);assert.equal(await request('/theme.css',{headers:new Headers({Authorization:'Bearer private'})}),null);
const signedIn=await request('/',{mode:'navigate'});assert.equal(await signedIn.text(),'Private signed-in HTML');assert(!data.has('/'));
privateAsset=true;data.delete('/theme.css');await request('/theme.css');assert(!data.has('/theme.css'));privateAsset=false;
offline=true;const page=await request('/#/account',{mode:'navigate'});assert.equal(await page.text(),'Neutral offline page');const pdf=await request('/assets/notes/100-important-homophones.pdf');assert.equal(await pdf.text(),'Public asset');assert(!data.has('/'));
console.log('PASS PWA public asset precache; neutral offline navigation/PDF; private HTML, APIs, auth routes and private responses never cached; old caches cleaned without affecting other apps.');
