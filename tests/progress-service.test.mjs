import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {progressEndpoint,adminEndpoint,emptyProgress,normaliseProgress} from '../lib/progress-service.mjs';
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0000_far_dust.sql','utf8'));
const DB={prepare(sql){return{bind(...values){return{async first(){return db.prepare(sql).get(...values)||null;}};},async all(){return{results:db.prepare(sql).all()};}};}};
const env={DB,PORTAL_ADMIN_EMAIL:'owner@example.test'},owner={userId:'owner',email:'owner@example.test',displayName:'Owner'},a={userId:'a',email:'a@example.test',displayName:'Ananya'},b={userId:'b',email:'b@example.test',displayName:'Bhavana'};
const request=(method='GET',body,origin='https://portal.test')=>new Request('https://portal.test/api/progress',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
async function put(user,payload,version=0,origin){return progressEndpoint(request('PUT',{payload,version},origin),user,env);}
async function data(r){return r.json();}
assert.equal((await progressEndpoint(request(),null,env)).status,401);
assert.equal((await adminEndpoint(request(),a,env)).status,403);
assert.equal((await put(a,emptyProgress(),0,'https://other.test')).status,403);
assert.equal((await progressEndpoint(request(),a,{})).status,503);
let p=emptyProgress();p.profile={name:'Ananya',exam:'GPSTR'};p.saved=['homophones-100'];p.read=['active-passive'];p.attempts=[{id:'test-a',testId:'mock-test-7',answers:Array(100).fill(1),score:999,total:999,finishedAt:Date.now()}];p.role='Admin';p.userId='b';
let r=await put(a,p);assert.equal(r.status,200);let d=await data(r);assert.equal(d.version,1);assert.equal(d.user.role,'Student');assert.equal(d.payload.attempts[0].total,100);assert.equal(d.payload.attempts[0].score,63.75);assert.equal(d.payload.role,undefined);
r=await progressEndpoint(request(),b,env);d=await data(r);assert.equal(d.version,0);assert.equal(d.payload.attempts.length,0);assert.equal(d.payload.saved.length,0);
r=await progressEndpoint(request(),a,env);d=await data(r);assert.equal(d.payload.saved[0],'homophones-100');assert.equal(r.headers.get('cache-control'),'no-store, private');
// A stale device cannot overwrite a newer state; its response carries the reconciliation base.
r=await put(a,{...p,saved:[]},0);assert.equal(r.status,409);d=await data(r);assert.equal(d.version,1);assert.equal(d.payload.saved[0],'homophones-100');
r=await put(a,{...p,saved:[]},1);assert.equal(r.status,200);assert.equal((await data(r)).version,2);assert.equal((await put(a,p,1)).status,409);
assert.equal((await put(b,{...emptyProgress(),attempts:[{id:'bad',testId:'mock-test-7',answers:[7],finishedAt:Date.now()}]})).status,400);
assert.equal((await put(b,{...emptyProgress(),saved:['unpublished-secret-note']})).status,400);
assert.equal((await put(b,{...emptyProgress(),customNotes:[{id:'preview-note-1792345678901',title:'x',body:'x'}]})).status,403);
assert.equal((await put(b,{...emptyProgress(),profile:{name:'x'.repeat(46),exam:'GPSTR'}})).status,400);
assert.equal((await put(b,{...emptyProgress(),drafts:{'mock-test-7':{answers:Array(100).fill(null),flags:[100],index:100,startedAt:Date.now()}}})).status,400);
// Server recomputes all important score boundaries.
const bank=JSON.parse(fs.readFileSync('lib/portal-catalogue.json'));const t=bank.tests.find(t=>t.id==='mock-test-7');
for(const [make,score]of [[q=>q.a,100],[q=>(q.a+1)%4,-25],[()=>null,0]]){const norm=normaliseProgress({...emptyProgress(),attempts:[{id:'score',testId:t.id,answers:t.questions.map(make),finishedAt:Date.now()}]},'Student');assert.equal(norm.attempts[0].score,score);}
await put(owner,{...emptyProgress(),attempts:[{id:'admin-practice',testId:'grammar',answers:[1,2,0,3,1],finishedAt:Date.now()}]});
await put(b,{...emptyProgress(),profile:{name:'Bhavana',exam:'HSTR'},attempts:[{id:'test-b',testId:'grammar',answers:[1,null,2,3,0],finishedAt:Date.now()}]});
r=await adminEndpoint(request(),owner,env);assert.equal(r.status,200);d=await data(r);assert.equal(d.learnerCount,2);assert.equal(d.totalAttempts,2);assert(!d.learners.some(s=>s.name==='Owner'));assert(d.topics.some(s=>s.topic==='Grammar & Usage'));assert.equal(d.learners.find(s=>s.name==='Bhavana').last.score,1.5);
console.log('PASS database migration; missing identity 401; Student/Admin separation; cross-user isolation; CSRF; scoped reads/writes; optimistic save conflicts; invalid records; authoritative scores; private Admin analytics and excluding Admin practice.');
