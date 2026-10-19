import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element=()=>{const attrs=new Map();return{isConnected:true,innerHTML:'',textContent:'',getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}};
function load(globals){const context=vm.createContext({esc,financeMoney:String,...globals});for(const name of ['admin-ui.js','finance-ledger-admin.js'])vm.runInContext(readFileSync('portal/'+name,'utf8'),context);return context;}
test('ledger link choices escape references, retain saved versions and do not auto-select a tuition target',()=>{
 const panel=element(),form={addEventListener(){}};const context=load({document:{getElementById:id=>id==='finance-ledger-preview'?panel:form}});
 context.renderFinanceLedgerPreview({batch:{id:'batch'},rows:[{rowId:'batch:1',rowNumber:1,version:2,transactionJson:JSON.stringify({source:'phonepe',transactionKind:'tuition',externalReference:'<script>sale</script>',grossPaise:99900})},{rowId:'batch:2',rowNumber:2,version:1,transactionJson:JSON.stringify({source:'appx',transactionKind:'activation',externalReference:'<img>',grossPaise:1500})}]});
 assert(!panel.innerHTML.includes('<script>'));assert(!panel.innerHTML.includes('<img>'));assert(!panel.innerHTML.includes(' selected'));assert.match(panel.innerHTML,/Not linked/);assert.match(panel.innerHTML,/Unsaved review edits are excluded/);assert.deepEqual(JSON.parse(JSON.stringify(form.ledgerVersions)),[{rowId:'batch:1',version:2},{rowId:'batch:2',version:1}]);context.renderFinanceLedgerPreview(null);assert.equal(panel.innerHTML,'');
});
function harness(fetch){const fields={batchId:{value:'batch',disabled:false}},select={value:'batch:1',disabled:false,getAttribute:()=> 'batch:2'},results=element(),form=Object.assign(element(),{elements:fields,ledgerVersions:[{rowId:'batch:1',version:1},{rowId:'batch:2',version:2}],querySelectorAll:selector=>selector==='[data-ledger-row]'?[select]:[...Object.values(fields),select]});const context=load({document:{getElementById:()=>results},fetch});return{fields,select,results,form,context};}
test('stale review errors preserve link choices; previews send saved IDs/versions rather than editable totals',async()=>{
 let sent;const h=harness(async(_url,options)=>{sent=JSON.parse(options.body);return{ok:false,json:async()=>({error:'Reviews changed. Reload.'})}});await h.context.previewSavedLedger(h.form);assert.match(h.results.textContent,/Reviews changed/);assert.equal(h.select.value,'batch:1');assert.equal(h.select.disabled,false);assert.deepEqual(sent,{batchId:'batch',versions:[{rowId:'batch:1',version:1},{rowId:'batch:2',version:2}],links:[{rowId:'batch:2',targetRowId:'batch:1'}]});
});
test('result rendering labels incomplete proposals, escapes blockers and suppresses responses after navigation',async()=>{
 const data={blockedCount:1,rows:[{rowId:'<script>',kind:'tuition',version:1,ruleEligible:false,blockers:['<img>'],targetRowId:'<iframe>'}],totalsComplete:false,totals:{tuitionGrossPaise:0,mockGrossPaise:0,activationGrossPaise:0,feePaise:0,refundPaise:0,cashNetPaise:0},note:'<svg>',approvalBlockers:['verification_required'],otherBatchReservations:[{reference:'<script>',activationCount:1,refundPaise:3000}]};const h=harness(async()=>({ok:true,json:async()=>data}));await h.context.previewSavedLedger(h.form);assert.match(h.results.innerHTML,/incomplete/);assert.match(h.results.innerHTML,/payment remains unverified/);for(const tag of ['script','img','iframe','svg'])assert(!h.results.innerHTML.includes('<'+tag+'>'));
 let resolve;const wait=new Promise(r=>{resolve=r}),late=harness(async()=>wait),pending=late.context.previewSavedLedger(late.form);late.form.isConnected=false;late.results.innerHTML='new page';resolve({ok:true,json:async()=>data});await pending;assert.equal(late.results.innerHTML,'new page');
});
test('saved preview sends only pinned saved-link versions and excludes temporary dropdown choices',async()=>{
 let sent;const h=harness(async(_url,options)=>{sent=JSON.parse(options.body);return{ok:false,json:async()=>({error:'Synthetic preview stopped'})}});h.form.ledgerLinkVersions=[{rowId:'batch:2',version:4}];await h.context.previewSavedLedger(h.form,true);assert.equal(sent.useSavedLinks,true);assert.deepEqual(sent.links,[]);assert.deepEqual(sent.linkVersions,[{rowId:'batch:2',version:4}]);
});
test('a pending preview cannot restore old totals after saved finance records invalidate it',async()=>{
 let resolve;const wait=new Promise(r=>{resolve=r}),h=harness(async()=>wait),pending=h.context.previewSavedLedger(h.form);h.context.invalidateFinanceLedgerPreview('Saved finance records changed. Run again.');h.results.innerHTML='';resolve({ok:true,json:async()=>({rows:[],blockedCount:0,totalsComplete:true,totals:{},note:'Old totals',approvalBlockers:[]})});await pending;assert.equal(h.results.innerHTML,'');assert.match(h.results.textContent,/Saved finance records changed/);
});
