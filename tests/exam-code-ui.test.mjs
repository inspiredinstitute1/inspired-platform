import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function setup(){
 const handlers={},nodes={},calls=[];
 const context=vm.createContext({document:{addEventListener:(n,f)=>handlers[n]=f,getElementById:id=>nodes[id]||null},esc:String,link:()=>'',examRequest:async(url,body)=>{calls.push(body);return{code:'synthetic',codeKind:body.codeKind,expiresAt:Date.now()+1000,note:body.codeKind==='complimentary'?'No payment claimed.':'Manual payment confirmation.'}}});
 vm.runInContext(readFileSync('portal/exam-admin.js','utf8'),context);
 nodes['exam-new-code']={textContent:''};nodes['exam-code-message']={textContent:''};
 const button={},paid={},free={},form={id:'exam-code-form',getAttribute:()=> 'exam-code-form',querySelector:s=>s==='button'?button:s==='[data-code-paid]'?paid:free,elements:{examId:{value:'paper'},email:{value:'learner@example.test'},validDays:{value:'1'},codeKind:{value:'complimentary'},paymentReference:{value:'Old paid reference'},paymentConfirmed:{checked:true},complimentaryReason:{value:'Scholarship'}}};
 return{handlers,nodes,calls,form,paid,free,context};
}
test('switching code type disables irrelevant fields and clears payment consent',()=>{
 const h=setup(),target={form:h.form,name:'codeKind',value:'complimentary'};h.handlers.change({target});
 assert.equal(h.paid.disabled,true);assert.equal(h.paid.hidden,true);assert.equal(h.free.disabled,false);assert.equal(h.form.elements.paymentConfirmed.checked,false);
 target.value='paid';h.handlers.change({target});assert.equal(h.free.disabled,true);assert.equal(h.paid.disabled,false);
 const html=h.context.examAdminPanel();assert.match(html,/name="complimentaryReason" required/);assert.match(html,/data-code-complimentary hidden disabled/);
});
test('complimentary submit excludes stale payment fields; paid submit excludes complimentary reason',async()=>{
 const h=setup();await h.handlers.submit({target:h.form,preventDefault(){}});
 assert.equal(h.calls[0].codeKind,'complimentary');assert.equal(h.calls[0].complimentaryReason,'Scholarship');assert(!('paymentReference' in h.calls[0]));assert(!('paymentConfirmed' in h.calls[0]));assert.match(h.nodes['exam-code-message'].textContent,/No payment claimed/);
 h.form.elements.codeKind.value='paid';h.form.elements.paymentConfirmed.checked=true;await h.handlers.submit({target:h.form,preventDefault(){}});
 assert.equal(h.calls[1].paymentConfirmed,true);assert.equal(h.calls[1].paymentReference,'Old paid reference');assert(!('complimentaryReason' in h.calls[1]));
});
