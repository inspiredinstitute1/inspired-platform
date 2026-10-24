import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element=()=>{const attrs=new Map();return{isConnected:true,innerHTML:'',textContent:'',getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}};
function load(globals){const context=vm.createContext({crypto,esc,...globals});for(const name of ['admin-ui.js','finance-import-admin.js'])vm.runInContext(readFileSync('portal/'+name,'utf8'),context);return context;}
test('lost import response keeps input and request ID for retry; edited input receives a new ID',async()=>{
 const fields=Object.fromEntries(Object.entries({sourceLabel:'Synthetic export',reason:'Review batch',format:'json',data:'[]'}).map(([key,value])=>[key,{value,disabled:false}])),message=element(),requests=[];
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields)});let fail=true;
 const context=load({document:{getElementById:()=>message},fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);if(fail)throw Error('Synthetic connection failure');return{ok:true,json:async()=>({batchId:body.requestId,acceptedRows:1,duplicateRows:0,rejectedRows:0,idempotentReplay:true})}}});context.loadFinanceImports=async()=>{};
 await context.saveFinanceImport(form);assert.equal(fields.data.value,'[]');assert.equal(fields.data.disabled,false);fail=false;await context.saveFinanceImport(form);assert.equal(requests[0].requestId,requests[1].requestId);assert.match(message.textContent,/Existing import recovered/);
 fields.data.value='[{}]';await context.saveFinanceImport(form);assert.notEqual(requests[2].requestId,requests[1].requestId);
});
test('pending import blocks repeated saves and Clear cannot erase the input while saving',async()=>{
 let resolve;const wait=new Promise(r=>{resolve=r}),fields=Object.fromEntries(Object.entries({sourceLabel:'Synthetic export',reason:'Review batch',format:'json',data:'[]'}).map(([key,value])=>[key,{value,disabled:false}])),message=element();let requests=0,resets=0;
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields),reset(){resets++}}),context=load({document:{getElementById:id=>id==='finance-import-form'?form:message},fetch:async()=>{requests++;return wait}});context.loadFinanceImports=async()=>{};
 const first=context.saveFinanceImport(form);await context.saveFinanceImport(form);context.clearFinanceImport();assert.equal(requests,1);assert.equal(resets,0);assert(fields.data.disabled);
 resolve({ok:true,json:async()=>({batchId:'batch',acceptedRows:0,duplicateRows:0,rejectedRows:1})});await first;assert.equal(fields.data.disabled,false);context.clearFinanceImport();assert.equal(resets,1);
});
test('import review escapes source labels, references, raw fields, claimed matches and issues',async()=>{
 const list=element(),rows=element(),audit=element(),context=load({financeMoney:value=>String(value),document:{getElementById:id=>id==='finance-import-batches'?list:id==='finance-import-rows'?rows:audit},fetch:async()=>({ok:true,json:async()=>({batches:[],selected:{sourceLabel:'<script>label</script>'},rows:[{rowNumber:1,verdict:'duplicate',transactionJson:JSON.stringify({source:'phonepe',externalReference:'<img src=x>',transactionKind:'tuition',paidAt:'2026-10-19',grossPaise:100,feePaise:0,netPaise:100,studentId:'<svg onload=alert(1)>',courseCode:'Grammar'}),rawJson:JSON.stringify({externalReference:'<iframe>bad</iframe>'}),flagsJson:'["reference_conflict"]',issue:'<script>issue</script>'}],audit:[]})})});
 await context.loadFinanceImports();assert(!rows.innerHTML.includes('<script>'));assert(!rows.innerHTML.includes('<img'));assert(!rows.innerHTML.includes('<svg'));assert(!rows.innerHTML.includes('<iframe'));assert.match(rows.innerHTML,/&lt;img/);assert.match(rows.innerHTML,/unverified records/);
});
