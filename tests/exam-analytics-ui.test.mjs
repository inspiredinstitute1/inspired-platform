import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {analyseExams} from '../lib/exam-analytics.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(examRequest){
 const events={},box={isConnected:true,dataset:{},innerHTML:'',textContent:''};
 const context=vm.createContext({document:{getElementById:()=>box,addEventListener:(name,fn)=>events[name]=fn},cloud:{user:{role:'Admin'}},esc,intro:()=>'',link:()=>'',examRequest});
 vm.runInContext(readFileSync('portal/exam-analytics.js','utf8'),context);
 return{context,events,box};
}
test('timed-out analytics offers a clear retry instead of the raw browser abort message',async()=>{
 const h=setup(async()=>{throw Object.assign(Error('signal is aborted without reason'),{name:'AbortError'});});
 await h.context.loadExamAnalytics();
 assert.match(h.box.innerHTML,/took too long/i);assert.match(h.box.innerHTML,/Try again/);
 assert(!h.box.innerHTML.includes('signal is aborted'));assert.match(h.box.innerHTML,/saved test results are retained/i);
});
test('analytics retry preserves cohort, own-results or selected-learner scope and can recover',async()=>{
 for(const [learner,self,suffix] of [['',false,''],['',true,'?scope=self'],['opaque learner / ಕನ್ನಡ',false,'?learnerId='+encodeURIComponent('opaque learner / ಕನ್ನಡ')]]){
  const calls=[];const h=setup(async path=>{calls.push(path);if(calls.length===1)throw Error('Connection interrupted');return{...analyseExams([]),scope:'self',limited:false};});
  await h.context.loadExamAnalytics(learner,self);assert.match(h.box.innerHTML,/Try again/);
  await h.events.click({target:{closest:selector=>selector==='[data-analytics-retry]'?{dataset:{analyticsRetryLearner:learner,analyticsRetrySelf:String(self)}}:null}});
  assert.deepEqual(calls,['/api/exams/analytics'+suffix,'/api/exams/analytics'+suffix]);
  assert.match(h.box.innerHTML,/No finalized attempts yet/);assert(!h.box.innerHTML.includes('Connection interrupted'));
 }
});
test('an older failed analytics request cannot replace a newer successful report',async()=>{
 let rejectFirst;const first=new Promise((_,reject)=>{rejectFirst=reject});let calls=0;
 const h=setup(async()=>++calls===1?first:{...analyseExams([]),scope:'self',limited:false});
 const pending=h.context.loadExamAnalytics();await h.context.loadExamAnalytics('',true);const report=h.box.innerHTML;
 rejectFirst(Error('Late failure'));await pending;assert.equal(h.box.innerHTML,report);
});
