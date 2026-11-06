import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {materialEndpoint,publicMaterialsEndpoint} from '../lib/material-service.mjs';
import {resourceEndpoint,publicProgrammeResources} from '../lib/resource-service.mjs';
import {contentEndpoint} from '../lib/content-service.mjs';
const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql',...['0004_content_manager','0005_programme_resources','0008_authored_materials'].map(name=>`docs/migrations/${name}.sql`)])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test',path='/api/admin/materials')=>new Request('https://local.test'+path,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>materialEndpoint(request(method,body,origin),user,env);
 const read=(id)=>publicMaterialsEndpoint(request('GET',undefined,undefined,'/api/materials'+(id?'?id='+encodeURIComponent(id):'')),env);
 const base={title:'Synthetic grammar note',category:'Grammar',body:'Rule: use the correct tense.\n\nಉದಾಹರಣೆ: synthetic only.',status:'draft',reason:'Create review note'};
 async function create(changes={}){const body={...base,...changes},response=await call(body);assert.equal(response.status,201,await response.clone().text());return{...body,...await response.json()};}
 return{db,DB,env,request,call,read,base,create};
}
test('material writes require Admin, same-origin JSON and valid bounded plain text; creation is draft-only',async()=>{
 const h=setup();try{
  for(const user of [null,student])for(const body of [undefined,h.base])assert.equal((await h.call(body,user)).status,403);
  assert.equal((await h.call(h.base,owner,'POST','https://other.test')).status,403);
  assert.equal((await h.call({},owner,'DELETE')).status,405);
  for(const changes of [{status:'published'},{status:'review'},{status:'unexpected'},{body:' '},{body:'a'.repeat(20001)},{title:'a'.repeat(121)},{category:''},{reason:'a'}])assert.equal((await h.call({...h.base,...changes})).status,400);
  assert.equal((await materialEndpoint(new Request('https://local.test/api/admin/materials',{method:'POST',headers:{origin:'https://local.test'},body:'{}'}),owner,h.env)).status,415);
  assert.equal((await materialEndpoint(new Request('https://local.test/api/admin/materials',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json'},body:'broken'}),owner,h.env)).status,400);
 }finally{h.db.close()}
});
test('draft/review/archive note bodies never appear on public list, detail or forged query filters',async()=>{
 const h=setup();try{
  const note=await h.create({body:'PRIVATE DRAFT BODY'});
  assert.equal((await h.read(note.id)).status,404);assert.equal((await(await h.read()).json()).notes.length,0);
  assert.equal((await h.call({...note,status:'review'})).status,200);assert.equal((await h.read(note.id)).status,404);
  const forged=await publicMaterialsEndpoint(h.request('GET',undefined,undefined,'/api/materials?status=draft&userId=owner'),h.env);assert(!JSON.stringify(await forged.json()).includes('PRIVATE'));
  assert.equal((await h.call({...note,version:2,status:'published',actorId:'forged'})).status,200);
  const list=await(await h.read()).json();assert.equal(list.notes.length,1);for(const field of ['body','version','changed_by','change_reason','status'])assert(!(field in list.notes[0]));
  const detail=await h.read(note.id);assert.match(detail.headers.get('cache-control'),/no-store/);const data=await detail.json();assert.equal(data.note.body,note.body);assert(!('version' in data.note));
  assert.equal((await h.call({...note,version:3,status:'archived'})).status,200);assert.equal((await h.read(note.id)).status,404);assert.equal((await(await h.read()).json()).notes.length,0);
  assert.equal((await h.read('preview-note-1')).status,404);
 }finally{h.db.close()}
});
test('note conflicts preserve full atomic audit, trusted actor and history on archive and migration reapplication',async()=>{
 const h=setup();try{
  const note=await h.create();assert.equal((await h.call({...note,status:'review',body:'Revised text',actorId:'spoof'})).status,200);
  assert.equal((await h.call({...note,status:'published'})).status,409);
  const audit=h.db.prepare('SELECT * FROM material_audit ORDER BY id').all();assert.equal(audit.length,2);assert.equal(audit[1].actor_id,'owner');assert.equal(JSON.parse(audit[1].previous_json).body,note.body);assert.equal(JSON.parse(audit[1].next_json).body,'Revised text');
  assert.throws(()=>h.db.exec('DELETE FROM authored_materials'),/Archive materials/);assert.throws(()=>h.db.exec('DELETE FROM material_audit'),/append-only/);assert.throws(()=>h.db.exec("UPDATE material_audit SET reason='tamper'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0008_authored_materials.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM material_audit').get().n,2);
  const admin=await(await h.call()).json();assert.equal(admin.notes[0].body,'Revised text');assert(!JSON.stringify(admin.audit).includes('Revised text'));
 }finally{h.db.close()}
});
test('an audit failure rolls back both new note creation and existing note edits',async()=>{
 const h=setup();try{
  const note=await h.create();h.db.exec("CREATE TRIGGER block_material_audit BEFORE INSERT ON material_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
  assert.equal((await h.call({...note,body:'Lost edit'})).status,503);assert.equal((await h.call(h.base)).status,503);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM authored_materials').get().n,1);assert.equal(h.db.prepare('SELECT body FROM authored_materials').get().body,note.body);
 }finally{h.db.close()}
});
test('authored note links resolve server metadata and require both note and programme publication',async()=>{
 const h=setup();try{
  const response=await contentEndpoint(h.request('POST',{kind:'division',parentId:null,title:'Synthetic division',description:'',sortOrder:1,status:'published',reason:'Test publication'}),owner,h.env);assert.equal(response.status,201);const node=await response.json();
  const note=await h.create(),link={nodeId:node.id,kind:'note',resourceId:note.id,enabled:true,sortOrder:1,reason:'Link authored draft',title:'FORGED',href:'javascript:alert(1)'};
  const linked=await resourceEndpoint(h.request('POST',link),owner,h.env);assert.equal(linked.status,201);assert.equal((await publicProgrammeResources(h.DB)).length,0);
  assert.equal((await h.call({...note,status:'published'})).status,200);let resources=await publicProgrammeResources(h.DB);assert.equal(resources.length,1);assert.equal(resources[0].title,note.title);assert.equal(resources[0].href,'#/material/'+note.id);
  assert.equal((await h.call({...note,version:2,status:'draft'})).status,200);assert.equal((await publicProgrammeResources(h.DB)).length,0);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_resources').get().n,1);
  assert.equal((await resourceEndpoint(h.request('POST',{...link,resourceId:'authored-'+crypto.randomUUID()}),owner,h.env)).status,400);
 }finally{h.db.close()}
});
