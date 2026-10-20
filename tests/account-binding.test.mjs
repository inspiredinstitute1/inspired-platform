import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {progressEndpoint,emptyProgress} from '../lib/progress-service.mjs';
const a={userId:'synthetic-a',email:'a@example.test'},b={userId:'synthetic-b',email:'b@example.test'};
function setup(){const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_far_dust.sql','utf8'));const DB={prepare(sql){const statement=db.prepare(sql);return{bind(...values){return{async first(){return statement.get(...values)||null;}}}}}};return{db,env:{DB,PORTAL_ADMIN_EMAIL:'owner@example.test'}};}
function request(method='GET',id=a.userId,body={version:0,payload:emptyProgress()}){return new Request('https://local.test/api/progress',{method,headers:{origin:'https://local.test','content-type':'application/json',...(id===null?{}:{'x-portal-account-id':encodeURIComponent(id)})},...(method==='GET'?{}:{body:JSON.stringify(body)})});}
test('stale-tab GET and PUT reject replacement sessions before reading a database or body',async()=>{
 let queries=0;const env={DB:{prepare(){queries++;throw Error('Must not be queried')}}};
 for(const method of ['GET','PUT']){const r=await progressEndpoint(request(method),b,env);assert.equal(r.status,409);assert.match(r.headers.get('cache-control'),/no-store/);assert.deepEqual(await r.json(),{error:'Your signed-in account changed. Refresh before syncing.',code:'ACCOUNT_CHANGED'});}
 assert.equal(queries,0);
});
test('progress PUT requires an explicit account precondition; GET remains session-scoped for compatible readers',async()=>{const h=setup();try{const r=await progressEndpoint(request('PUT',null),a,h.env);assert.equal(r.status,428);assert.equal((await r.json()).code,'ACCOUNT_REQUIRED');assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM learner_progress').get().n,0);assert.equal((await progressEndpoint(request('GET',null),a,h.env)).status,200);}finally{h.db.close()}});
test('binding is a precondition, never authentication; signed-out requests remain unauthorized',async()=>{for(const method of ['GET','PUT']){const r=await progressEndpoint(request(method),null,{});assert.equal(r.status,401);assert(!('payload' in await r.json()));}});
test('matching account binding keeps optimistic conflicts identity-bound and isolates forged body IDs',async()=>{const h=setup();try{
 const body={version:0,userId:b.userId,role:'Admin',payload:{...emptyProgress(),goal:7}};
 const saved=await progressEndpoint(request('PUT',a.userId,body),a,h.env);assert.equal(saved.status,200);assert.equal((await saved.json()).user.id,a.userId);
 const conflict=await progressEndpoint(request('PUT',a.userId,body),a,h.env);assert.equal(conflict.status,409);const data=await conflict.json();assert.equal(data.user.id,a.userId);assert.equal(data.user.role,'Student');assert.equal(data.version,1);
 const other=await progressEndpoint(request('GET',b.userId),b,h.env);assert.equal((await other.json()).version,0);
 const stale=await progressEndpoint(request('PUT',a.userId,body),b,h.env);assert.equal(stale.status,409);assert(!('payload' in await stale.json()));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM learner_progress').get().n,1);
}finally{h.db.close()}});
test('account preconditions round-trip opaque IDs through header encoding',async()=>{const h=setup();try{const user={...a,userId:'opaque /ಕನ್ನಡ%'};assert.equal((await progressEndpoint(request('PUT',user.userId),user,h.env)).status,200);}finally{h.db.close()}});
