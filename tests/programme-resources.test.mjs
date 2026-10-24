import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import catalogue from '../lib/resource-catalogue.json' with {type:'json'};
import {resourceEndpoint} from '../lib/resource-service.mjs';
import {contentEndpoint,catalogueEndpoint} from '../lib/content-service.mjs';

const owner={userId:'synthetic-owner',email:'owner@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql','docs/migrations/0004_content_manager.sql','docs/migrations/0005_programme_resources.sql'])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){const result=statement.run(...values);return{meta:{changes:Number(result.changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test')=>new Request('https://local.test/api/admin/resources',{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>resourceEndpoint(request(method,body,origin),user,env);
 const content=body=>contentEndpoint(request('POST',body),owner,env);
 const publicCall=async()=>{const response=await catalogueEndpoint(request(),env);assert.equal(response.status,200);return response.json();};
 const root={kind:'division',parentId:null,title:'Synthetic division',description:'',status:'published',sortOrder:1,reason:'Synthetic test setup'};
 async function createNode(data={}){const body={...root,...data};const response=await content(body);assert.equal(response.status,201);return{...body,...await response.json()};}
 const link=(node,kind='note',changes={})=>({nodeId:node.id,kind,resourceId:catalogue.find(item=>item.kind===kind).id,enabled:true,sortOrder:100,reason:'Link existing free material',...changes});
 async function createLink(body){const response=await call(body);assert.equal(response.status,201,await response.clone().text());return{...body,...await response.json()};}
 return {db,env,request,call,content,publicCall,createNode,link,createLink};
}

test('resource manager blocks non-Admin users, cross-origin writes and deletion',async()=>{
 const h=setup();try{
  for(const user of [null,{userId:'student',email:'student@example.test'}])for(const body of [undefined,{}])assert.equal((await h.call(body,user)).status,403);
  assert.equal((await h.call({},owner,'POST','https://other.test')).status,403);
  assert.equal((await h.call({},owner,'DELETE')).status,405);
 }finally{h.db.close()}
});

test('existing notes, videos and tests link in chosen order with trusted metadata only',async()=>{
 const h=setup();try{
  const node=await h.createNode();
  for(const [index,kind] of ['video','note','test'].entries())await h.createLink(h.link(node,kind,{sortOrder:index,href:'javascript:alert(1)',title:'Forged title'}));
  const data=await h.publicCall();assert.deepEqual(data.resources.map(item=>item.kind),['video','note','test']);
  for(const item of data.resources){const trusted=catalogue.find(resource=>resource.kind===item.kind&&resource.id===item.resourceId);assert.equal(item.title,trusted.title);assert.equal(item.href,trusted.href);assert(!('version' in item));assert(!('reason' in item));}
  const admin=await (await h.call()).json();assert.equal(admin.links.length,3);assert.equal(admin.audit.length,3);
  assert(admin.resources.every(item=>Object.keys(item).sort().join(',')==='href,id,kind,title'));
 }finally{h.db.close()}
});

test('unknown resources, private preview notes, orphan programmes and duplicate links are rejected',async()=>{
 const h=setup();try{
  const node=await h.createNode(),body=h.link(node);
  for(const resourceId of ['unknown','preview-note-1792400000000'])assert.equal((await h.call({...body,resourceId})).status,400);
  assert.equal((await h.call({...body,nodeId:crypto.randomUUID()})).status,404);
  await h.createLink(body);assert.equal((await h.call(body)).status,409);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM resource_audit').get().n,1);
 }finally{h.db.close()}
});

test('hidden links and unpublished ancestor branches disappear without deleting materials or link history',async()=>{
 const h=setup();try{
  let root=await h.createNode();const course=await h.createNode({kind:'course',parentId:root.id});
  const linked=await h.createLink(h.link(course));
  assert.equal((await h.publicCall()).resources.length,1);
  assert.equal((await h.call({...linked,enabled:false})).status,200);
  assert.equal((await h.publicCall()).resources.length,0);
  assert.equal((await h.call({...linked,version:2,enabled:true})).status,200);
  root={...root,status:'paused'};assert.equal((await h.content(root)).status,200);
  assert.equal((await h.publicCall()).resources.length,0);
  assert.equal((await h.content({...root,version:2,status:'published'})).status,200);
  assert.equal((await h.publicCall()).resources.length,1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_resources').get().n,1);
  assert(catalogue.some(item=>item.id===linked.resourceId));
 }finally{h.db.close()}
});

test('link edits enforce versions and immutable identities with append-only actor/audit snapshots',async()=>{
 const h=setup();try{
  const node=await h.createNode(),other=await h.createNode({title:'Other division'}),linked=await h.createLink(h.link(node));
  assert.equal((await h.call({...linked,sortOrder:1,reason:'Reorder material',actorId:'forged'})).status,200);
  assert.equal((await h.call({...linked,enabled:false})).status,409);
  assert.equal((await h.call({...linked,version:2,nodeId:other.id})).status,400);
  const records=h.db.prepare('SELECT * FROM resource_audit ORDER BY id').all();assert.equal(records.length,2);assert.equal(records[1].actor_id,owner.userId);
  assert.equal(JSON.parse(records[1].previous_json).sort_order,100);assert.equal(JSON.parse(records[1].next_json).sort_order,1);
  assert.throws(()=>h.db.exec('DELETE FROM programme_resources'),/Disable resource/);
  assert.throws(()=>h.db.exec('DELETE FROM resource_audit'),/append-only/);
  assert.throws(()=>h.db.exec("UPDATE resource_audit SET reason='tampered'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0005_programme_resources.sql','utf8'));
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM resource_audit').get().n,2);
 }finally{h.db.close()}
});

test('resource audit failure rolls back its link write',async()=>{
 const h=setup();try{
  const node=await h.createNode();
  h.db.exec("CREATE TRIGGER block_resource_audit BEFORE INSERT ON resource_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
  assert.equal((await h.call(h.link(node))).status,503);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_resources').get().n,0);
 }finally{h.db.close()}
});
