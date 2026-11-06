import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element=()=>{const attrs=new Map();return{isConnected:true,innerHTML:'',textContent:'',getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)}};
function load(globals){const context=vm.createContext({esc,financeMoney:String,...globals});for(const name of ['admin-ui.js','finance-review-admin.js'])vm.runInContext(readFileSync('portal/'+name,'utf8'),context);return context;}
const payload=()=>({batch:{id:'batch',sourceLabel:'<script>batch</script>'},rows:[{rowId:'batch:1',rowNumber:1,transactionJson:JSON.stringify({source:'phonepe',externalReference:'<img>',studentId:'student',courseCode:'programme',netPaise:100}),learnerId:null,nodeId:null,status:'pending',evidenceReference:'<iframe>',evidenceNotes:'<script>notes</script>',version:0}],learners:[{id:'student',name:'<svg>',email:'learner@example.test'}],programmes:[{id:'programme',title:'<script>title</script>',kind:'course',status:'archived'}],audit:[{rowId:'batch:1',actorId:'owner',reason:'<img>',previousJson:null,nextJson:'{"evidence_notes":"<script>"}',changedAt:1}]});
test('review form escapes claims, labels, evidence and audit; claimed IDs are never preselected',async()=>{
 const nodes=Object.fromEntries(['finance-review-list','finance-review-editor','finance-review-audit'].map(id=>[id,element()])),context=load({document:{getElementById:id=>nodes[id]},fetch:async()=>({ok:true,json:async()=>payload()})});await context.loadFinanceReview('batch');context.openFinanceReview('batch:1');
 for(const node of Object.values(nodes)){assert(!node.innerHTML.includes('<script>'));assert(!node.innerHTML.includes('<svg>'));assert(!node.innerHTML.includes('<img>'));assert(!node.innerHTML.includes('<iframe>'));}
 const html=nodes['finance-review-editor'].innerHTML;assert(!html.includes('value="student" selected'));assert(!html.includes('value="programme" selected'));assert.match(html,/value="0"/);assert.match(html,/archived/);assert.match(html,/&lt;iframe&gt;/);
});
test('review conflict preserves unsaved evidence/version and re-enables fields; success reloads saved version',async()=>{
 const fields=Object.fromEntries(Object.entries({rowId:'batch:1',version:'1',learnerId:'',nodeId:'',status:'disputed',evidenceReference:'Unsaved reference',evidenceNotes:'Unsaved notes',reason:'Investigate mismatch'}).map(([key,value])=>[key,{value,disabled:false}])),message=element(),requests=[];
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields)});let conflict=true,reloaded;
 const context=load({document:{getElementById:()=>message},fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return{ok:!conflict,json:async()=>conflict?{error:'A newer review exists. Reload.'}:{version:2}}}});context.loadFinanceReview=async(_batch,id)=>{reloaded=id};
 await context.saveFinanceReview(form);assert.equal(fields.version.value,'1');assert.equal(fields.evidenceNotes.value,'Unsaved notes');assert.equal(fields.evidenceNotes.disabled,false);assert.match(message.textContent,/newer review/);assert.equal(requests[0].learnerId,null);
 conflict=false;await context.saveFinanceReview(form);assert.equal(reloaded,'batch:1');assert.match(message.textContent,/remains unverified/);
});
test('late batch responses cannot replace a newer selected batch or its editor',async()=>{
 const nodes=Object.fromEntries(['finance-review-list','finance-review-editor','finance-review-audit'].map(id=>[id,element()]));let resolve;
 const slow=new Promise(r=>{resolve=r}),context=load({document:{getElementById:id=>nodes[id]},fetch:async url=>url.includes('old')?slow:{ok:true,json:async()=>({...payload(),batch:{id:'new',sourceLabel:'New batch'}})}});
 const first=context.loadFinanceReview('old');await context.loadFinanceReview('new');context.openFinanceReview('batch:1');const currentEditor=nodes['finance-review-editor'].innerHTML;resolve({ok:true,json:async()=>payload()});await first;assert.match(nodes['finance-review-list'].innerHTML,/New batch/);assert.equal(nodes['finance-review-editor'].innerHTML,currentEditor);
});
