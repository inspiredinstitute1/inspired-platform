import assert from 'node:assert/strict';
import test from 'node:test';
import {examsEndpoint} from '../lib/exam-service.mjs';

const alice={userId:'student-alice',email:'alice@example.org'};
const bob={userId:'student-bob',email:'bob@example.org'};
const foreignAttempt='attempt-owned-by-bob';
const queries=[];
const env={DB:{prepare(sql){
 queries.push(sql);
 if(sql.includes('FROM portal_modules'))return {all:async()=>({results:[{key:'practice',enabled:1,showNavigation:1,version:1}]})};
 if(sql.includes('FROM exam_attempts WHERE id=? AND learner_id=?'))return {bind(id,learnerId){
  assert.equal(id,foreignAttempt);
  assert.equal(learnerId,alice.userId,'attempt lookup must use the authenticated learner');
  return {first:async()=>null};
 }};
 throw Error('Unexpected database query: '+sql);
}}};
const url='https://inspiredinstitute.in/api/exams';
function request(method,body){
 const headers={'x-portal-account-id':encodeURIComponent(alice.userId)};
 if(body!==undefined){headers.origin='https://inspiredinstitute.in';headers['content-type']='application/json';}
 return new Request(url+(method==='GET'?'?attemptId='+foreignAttempt:''),{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
}
test('a student cannot read another student exam attempt',async()=>{
 queries.length=0;
 const res=await examsEndpoint(request('GET'),alice,env);
 assert.equal(res.status,404);
 assert.match((await res.json()).error,/not found/i);
 assert.equal(queries.filter(sql=>sql.includes('FROM exam_attempts WHERE id=? AND learner_id=?')).length,1);
});
test('a student cannot save or submit another student exam attempt',async()=>{
 for(const action of ['save','submit']){
  queries.length=0;
  const res=await examsEndpoint(request('POST',{action,attemptId:foreignAttempt,version:1,answers:[1]}),alice,env);
  assert.equal(res.status,404,action);
  assert.match((await res.json()).error,/not found/i);
  assert.equal(queries.filter(sql=>sql.includes('FROM exam_attempts WHERE id=? AND learner_id=?')).length,1);
 }
});
test('switching student accounts invalidates the exam account binding',async()=>{
 const req=request('GET');
 const res=await examsEndpoint(req,bob,env);
 assert.equal(res.status,409);
});
