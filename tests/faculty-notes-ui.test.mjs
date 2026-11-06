import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const element=()=>{const attrs=new Map();return{isConnected:true,innerHTML:'',textContent:'',getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)}};
function load(globals){const context=vm.createContext(globals);for(const name of ['admin-ui.js','faculty-notes.js'])vm.runInContext(readFileSync('portal/'+name,'utf8'),context);return context;}
function draftHarness(){
 const fields=Object.fromEntries(Object.entries({id:'',version:'',courseId:'course',title:'Draft',category:'Grammar',body:'Original note',status:'draft',reason:'Save draft'}).map(([key,value])=>[key,{value,disabled:false}]));
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields),reset(){for(const key of ['id','version','reason','body','title'])fields[key].value='';fields.status.value='draft';fields.courseId.disabled=false}}),message=element(),requests=[];
 let succeed=true;
 const context=load({document:{getElementById:id=>id==='faculty-note-form'?form:message},fetch:async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);return{ok:succeed,json:async()=>succeed?{id:'proposal',version:(body.version||0)+1}:{error:'Proposal changed or access was removed.'}}}});context.loadFacultyNotes=async()=>{};
 return{context,form,fields,message,requests,setSuccess:value=>{succeed=value}};
}
test('faculty draft editor retains course identity, clears submitted draft and preserves text after revocation conflict',async()=>{
 const h=draftHarness();await h.context.saveFacultyNote(h.form);assert.equal(h.fields.version.value,1);assert.equal(h.fields.courseId.disabled,true);
 h.fields.body.value='Revised note';h.fields.reason.value='Revise draft';h.setSuccess(false);await h.context.saveFacultyNote(h.form);
 assert.equal(h.fields.body.value,'Revised note');assert.equal(h.fields.version.value,1);assert.equal(h.fields.reason.value,'Revise draft');assert.equal(h.fields.body.disabled,false);assert.match(h.message.textContent,/access was removed/);
 h.setSuccess(true);h.fields.status.value='submitted';await h.context.saveFacultyNote(h.form);assert.equal(h.requests[2].version,1);assert.equal(h.fields.id.value,'');assert.equal(h.fields.courseId.disabled,false);assert.match(h.message.textContent,/not published/);
});
test('faculty proposals escape note text and Admin feedback and expose edit controls only for drafts',async()=>{
 const target=element(),form={elements:{courseId:{value:'',innerHTML:''}},hidden:false};
 const context=load({esc,document:{getElementById:id=>id==='faculty-note-list'?target:form},fetch:async()=>({ok:true,json:async()=>({courses:[{id:'course',title:'<script>course</script>'}],proposals:[{id:'one',courseId:'course',title:'Draft',body:'<img src=x onerror=alert(1)>',reviewNote:'<iframe>feedback</iframe>',status:'draft'},{id:'two',courseId:'course',title:'Submitted',body:'Locked',reviewNote:'',status:'submitted'}]})})});
 await context.loadFacultyNotes();assert(!target.innerHTML.includes('<img'));assert(!target.innerHTML.includes('<iframe'));assert.match(target.innerHTML,/&lt;img/);assert.equal((target.innerHTML.match(/faculty-note-edit/g)||[]).length,1);assert.equal(form.hidden,false);
});
test('Admin submission permission defaults to disabled and uses the selected grant version on save',async()=>{
 const target=element(),audit=element(),message=element(),fields={assignmentId:{value:'grant',innerHTML:''},version:{value:'',disabled:false},enabled:{checked:true,disabled:false},reason:{value:'',disabled:false}};
 const form=Object.assign(element(),{elements:fields,querySelectorAll:()=>Object.values(fields)});let saved;
 const context=load({esc,document:{getElementById:id=>id==='faculty-review-list'?target:id==='faculty-note-access-form'?form:id==='faculty-note-review-audit'?audit:message},fetch:async(_url,options)=>options?.method==='POST'?(saved=JSON.parse(options.body),{ok:true,json:async()=>({version:1})}):({ok:true,json:async()=>({access:[{assignmentId:'grant',name:'Teacher',courseTitle:'Course',enabled:0,version:0,teachingEnabled:1}],proposals:[],audit:[],accessAudit:[]})})});
 await context.loadFacultyNoteReview();assert.equal(fields.enabled.checked,false);assert.equal(fields.version.value,0);
 fields.enabled.checked=true;fields.reason.value='Enable separate permission';context.loadFacultyNoteReview=async()=>{};await context.saveFacultyNoteAccess(form);assert.equal(saved.version,0);assert.equal(saved.enabled,true);assert.equal(saved.action,'access');
});
