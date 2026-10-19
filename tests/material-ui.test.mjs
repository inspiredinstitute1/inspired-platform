import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{resolve,promise}};
const response=note=>({ok:true,json:async()=>({note})});
function load(globals){const context=vm.createContext({...globals});for(const file of ['admin-ui.js','material-admin.js'])vm.runInContext(readFileSync('portal/'+file,'utf8'),context);return context;}
test('public note reader escapes text instead of interpreting HTML and does not send credentials',async()=>{
 const target={isConnected:true,innerHTML:''};let options;
 const context=load({document:{getElementById:()=>target},esc,fetch:async(_url,opt)=>{options=opt;return response({title:'<img src=x onerror=alert(1)>',category:'<script>bad</script>',body:'<iframe src="javascript:alert(1)"></iframe>\nಕನ್ನಡ'})}});
 await context.loadMaterialReader('authored-test');assert(!target.innerHTML.includes('<iframe'));assert(!target.innerHTML.includes('<img'));assert.match(target.innerHTML,/&lt;iframe/);assert.match(target.innerHTML,/ಕನ್ನಡ/);assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
});
test('a late note response cannot overwrite a different reader after navigation',async()=>{
 const old={isConnected:true,innerHTML:''},current={isConnected:true,innerHTML:''},pending=deferred();let target=old;
 const context=load({document:{getElementById:()=>target},esc,fetch:()=>target===old?pending.promise:Promise.resolve(response({title:'Current note',category:'Grammar',body:'Current content'}))});
 const first=context.loadMaterialReader('old');old.isConnected=false;target=current;await context.loadMaterialReader('new');pending.resolve(response({title:'Stale note',category:'Old',body:'Stale content'}));await first;
 assert.equal(old.innerHTML,'');assert.match(current.innerHTML,/Current content/);assert(!current.innerHTML.includes('Stale'));
});
test('note save promotes draft identity/version, while a rejected publish preserves unsaved text for recovery',async()=>{
 const fields=Object.fromEntries(Object.entries({id:'',version:'',title:'Draft title',category:'Grammar',body:'Draft body',status:'draft',reason:'Create draft'}).map(([key,value])=>[key,{value,disabled:false}]));
 const attrs=new Map(),form={elements:fields,querySelectorAll:()=>Object.values(fields),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},message={};let succeed=true;const requests=[];
 const context=load({document:{getElementById:()=>message},fetch:async(_url,opt)=>{requests.push(JSON.parse(opt.body));return{ok:succeed,json:async()=>succeed?{id:'authored-test',version:1}:{error:'A newer version exists. Reload before editing.'}}}});context.loadMaterialAdmin=async()=>{};context.loadResourceAdmin=async()=>{};
 await context.saveMaterial(form);assert.equal(fields.version.value,1);assert.equal(fields.id.value,'authored-test');
 fields.status.value='published';fields.body.value='Unsaved correction';fields.reason.value='Publish correction';succeed=false;await context.saveMaterial(form);
 assert.equal(requests[1].version,1);assert.equal(fields.body.value,'Unsaved correction');assert.equal(fields.version.value,1);assert.equal(fields.reason.value,'Publish correction');assert.equal(fields.body.disabled,false);assert.match(message.textContent,/newer version/);
});
