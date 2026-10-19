import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { contentEndpoint, catalogueEndpoint } from '../lib/content-service.mjs';

const owner={userId:'synthetic-owner',email:'owner@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql','docs/migrations/0004_content_manager.sql','docs/migrations/0005_programme_resources.sql'])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){const r=statement.run(...values);return{meta:{changes:Number(r.changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method,body,origin='https://local.test')=>new Request('https://local.test/api/admin/content',{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>contentEndpoint(request(method,body,origin),user,env);
 const publicCall=()=>catalogueEndpoint(new Request('https://local.test/api/catalogue'),env);
 const base={kind:'division',parentId:null,title:'Synthetic division',description:'Synthetic description',status:'draft',sortOrder:100,reason:'Synthetic test change'};
 async function create(data={}){const body={...base,...data};const response=await call(body);assert.equal(response.status,201,await response.clone().text());return{...body,...await response.json()};}
 async function update(node,changes={}){const body={...node,...changes};const response=await call(body);assert.equal(response.status,200,await response.clone().text());return{...body,...await response.json()};}
 const nodes=()=>db.prepare('SELECT * FROM content_nodes').all();
 const audit=()=>db.prepare('SELECT * FROM content_audit ORDER BY id').all();
 return {db,env,request,call,publicCall,base,create,update,nodes,audit};
}

test('programme APIs reject guests, students, cross-origin writes and physical deletion',async()=>{
 const h=setup();try{
  for(const user of [null,{userId:'student',email:'student@example.test'}]){
   assert.equal((await h.call(undefined,user,'GET')).status,403);
   assert.equal((await h.call(h.base,user)).status,403);
  }
  assert.equal((await h.call(h.base,owner,'POST','https://other.test')).status,403);
  assert.equal((await h.call({id:crypto.randomUUID()},owner,'DELETE')).status,405);
  assert.equal(h.nodes().length,0);assert.equal(h.audit().length,0);
 }finally{h.db.close()}
});

test('programme validation rejects missing reasons, invalid types and orphan/cyclic parents',async()=>{
 const h=setup();try{
  for(const data of [{reason:''},{kind:'faculty'},{sortOrder:-1},{status:'live'},{kind:'course'},{parentId:crypto.randomUUID()}])assert.equal((await h.call({...h.base,...data})).status,400);
  const root=await h.create();
  assert.equal((await h.call({...root,parentId:root.id})).status,400);
  assert.equal(h.audit().length,1);
 }finally{h.db.close()}
});

test('all six programme types persist valid parent relationships and immutable kind',async()=>{
 const h=setup();try{
  const division=await h.create();
  const course=await h.create({kind:'course',parentId:division.id,title:'Course'});
  const subject=await h.create({kind:'subject',parentId:course.id,title:'Subject'});
  const teachingModule=await h.create({kind:'module',parentId:subject.id,title:'Module'});
  const series=await h.create({kind:'test_series',parentId:course.id,title:'Test series'});
  await h.create({kind:'test',parentId:series.id,title:'Series test'});
  await h.create({kind:'test',parentId:teachingModule.id,title:'Module test'});
  assert.equal(h.nodes().length,7);
  assert.equal((await h.call({...subject,kind:'module'})).status,400);
  assert.equal((await h.call({...teachingModule,parentId:course.id})).status,400);
  assert.deepEqual(h.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{h.db.close()}
});

test('published catalogue hides unpublished ancestors and restores intact descendants after pause/archive',async()=>{
 const h=setup();try{
  let division=await h.create();
  let course=await h.create({kind:'course',parentId:division.id});
  assert.equal((await h.call({...course,status:'published'})).status,400);
  division=await h.update(division,{status:'published'});
  course=await h.update(course,{status:'published'});
  assert.equal((await (await h.publicCall()).json()).programmes.length,2);
  for(const status of ['paused','archived']){
   division=await h.update(division,{status});
   assert.equal((await (await h.publicCall()).json()).programmes.length,0);
   assert.equal(h.nodes().length,2);
   assert.equal(h.nodes().find(node=>node.id===course.id).status,'published');
  }
  division=await h.update(division,{status:'published'});
  const visible=(await (await h.publicCall()).json()).programmes;
  assert.equal(visible.length,2);
  assert(!('changed_by' in visible[0]));assert(!('reason' in visible[0]));assert(!('version' in visible[0]));
 }finally{h.db.close()}
});

test('programme updates reject stale versions and record actor, reason and before/after atomically',async()=>{
 const h=setup();try{
  const original=await h.create();
  await h.update(original,{title:'Renamed division',sortOrder:1,reason:'Correct title and display order',actorId:'forged'});
  assert.equal((await h.call({...original,title:'Stale overwrite'})).status,409);
  assert.equal(h.audit().length,2);
  const record=h.audit()[1];assert.equal(record.actor_id,owner.userId);
  assert.equal(record.reason,'Correct title and display order');
  assert.equal(JSON.parse(record.previous_json).title,original.title);
  assert.equal(JSON.parse(record.next_json).title,'Renamed division');
  assert.equal(h.nodes()[0].title,'Renamed division');
 }finally{h.db.close()}
});

test('programme audit and record deletion protections preserve history on migration reapplication',async()=>{
 const h=setup();try{
  await h.create();
  assert.throws(()=>h.db.exec('DELETE FROM content_nodes'),/Archive programme/);
  assert.throws(()=>h.db.exec('DELETE FROM content_audit'),/append-only/);
  assert.throws(()=>h.db.exec("UPDATE content_audit SET reason='tampered'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0004_content_manager.sql','utf8'));
  assert.equal(h.nodes().length,1);assert.equal(h.audit().length,1);
  assert.equal(h.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{h.db.close()}
});

test('audit failure rolls back programme mutation without a partial write',async()=>{
 const h=setup();try{
  const node=await h.create();
  h.db.exec("CREATE TRIGGER block_audit BEFORE INSERT ON content_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
  assert.equal((await h.call({...node,title:'Must not persist'})).status,503);
  assert.equal(h.nodes()[0].title,node.title);assert.equal(h.nodes()[0].version,1);assert.equal(h.audit().length,1);
 }finally{h.db.close()}
});
