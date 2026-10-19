import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {libraryEndpoint} from '../lib/library-service.mjs';
import {emptyProgress,progressEndpoint} from '../lib/progress-service.mjs';
const student={userId:'student',email:'student@example.test'},other={userId:'other',email:'other@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of ['drizzle/0000_far_dust.sql','docs/migrations/0008_authored_materials.sql','docs/migrations/0010_pdf_materials.sql'])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:'owner@example.test'};
 function note(source='authored',status='published',title='Synthetic ಕನ್ನಡ note'){
  const id=source+'-'+crypto.randomUUID();
  if(source==='authored')db.prepare('INSERT INTO authored_materials(id,title,category,body,status,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(id,title,'ಹೊಸ ವಿಭಾಗ','Published excerpt. '+'x'.repeat(300),status,'private-owner','Private audit reason',1);
  else db.prepare('INSERT INTO pdf_materials(id,object_key,file_name,bytes,sha256,title,category,status,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,'private/key/'+id,'private-filename.pdf',100,'0'.repeat(64),title,'Grammar',status,'private-owner','Private audit reason',2);
  return id;
 }
 const request=(path='/api/library',method='GET',body)=>new Request('https://local.test'+path,{method,headers:{origin:'https://local.test','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const get=(path='/api/library')=>libraryEndpoint(request(path),env);
 const put=(payload,version=0,user=student)=>progressEndpoint(request('/api/progress','PUT',{payload,version,userId:other.userId}),user,env);
 const progress=(user=student)=>progressEndpoint(request('/api/progress'),user,env);
 return{db,DB,env,note,request,get,put,progress};
}
test('unified library lists only published text/PDF metadata and bounded excerpts without private fields',async()=>{
 const h=setup();try{
  const text=h.note(),pdf=h.note('pdf');for(const status of ['draft','review','archived']){h.note('authored',status,'SECRET '+status);h.note('pdf',status,'SECRET PDF '+status);}
  const response=await h.get('/api/library?status=draft&role=Admin'),data=await response.json();assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(data.notes.length,2);assert.deepEqual(new Set(data.notes.map(note=>note.id)),new Set([text,pdf]));assert.equal(data.notes.find(note=>note.id===text).description.length,160);
  const encoded=JSON.stringify(data);for(const secret of ['SECRET','private-owner','Private audit','private/key','private-filename','sha256','object_key','"version"','"body"','"status"'])assert(!encoded.includes(secret),secret);
 }finally{h.db.close()}
});
test('direct metadata reads fail closed for withdrawn, draft, malformed and unknown IDs',async()=>{
 const h=setup();try{
  const id=h.note('pdf');assert.equal((await h.get('/api/library?id='+id)).status,200);h.db.exec("UPDATE pdf_materials SET status='archived',version=version+1,change_reason='Withdraw synthetic PDF'");assert.equal((await h.get('/api/library?id='+id+'&status=published')).status,404);
  for(const id of [h.note('authored','draft'),'authored-'+crypto.randomUUID(),'preview-note-123','../../private'])assert.equal((await h.get('/api/library?id='+encodeURIComponent(id))).status,404);
 }finally{h.db.close()}
});
test('published text/PDF bookmarks and completion persist alongside original progress under the trusted account',async()=>{
 const h=setup();try{
  const text=h.note(),pdf=h.note('pdf'),payload={...emptyProgress(),saved:['homophones-100',text,pdf],read:[text,pdf]};
  const response=await h.put(payload),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.payload.saved,payload.saved);assert.deepEqual(data.payload.read,payload.read);assert.deepEqual(data.unavailableResources,[]);
  const own=await(await h.progress()).json();assert.deepEqual(own.payload.saved,payload.saved);assert.equal((await(await h.progress(other)).json()).payload.saved.length,0);
 }finally{h.db.close()}
});
test('new draft/nonexistent IDs are uniformly omitted without blocking valid progress or disclosing private content',async()=>{
 const h=setup();try{
  const draft=h.note('authored','draft','SECRET NOTE'),missing='pdf-'+crypto.randomUUID(),published=h.note('pdf');
  const response=await h.put({...emptyProgress(),saved:[draft,missing,published],read:[draft],goal:7}),data=await response.json();assert.equal(response.status,200);assert.deepEqual(data.payload.saved,[published]);assert.deepEqual(data.payload.read,[]);assert.equal(data.payload.goal,7);assert.deepEqual(new Set(data.unavailableResources),new Set([draft,missing]));assert(!JSON.stringify(data).includes('SECRET'));
  assert.equal((await h.put({...emptyProgress(),saved:['arbitrary-resource']},1)).status,400);
 }finally{h.db.close()}
});
test('withdrawn IDs remain valid only from this account history and can be removed without restoring content access',async()=>{
 const h=setup();try{
  const text=h.note(),pdf=h.note('pdf');await h.put({...emptyProgress(),read:[text],saved:[text,pdf]});
  h.db.exec("UPDATE authored_materials SET status='archived',version=version+1,change_reason='Withdraw source'");h.db.exec("UPDATE pdf_materials SET status='draft',version=version+1,change_reason='Withdraw file'");
  const own=await h.put({...emptyProgress(),read:[text],saved:[text,pdf],goal:6},1);assert.equal(own.status,200);assert.deepEqual((await own.json()).payload.saved,[text,pdf]);
  const stranger=await h.put({...emptyProgress(),read:[text],saved:[text,pdf]},0,other);assert.equal(stranger.status,200);assert.deepEqual((await stranger.json()).payload.saved,[]);
  assert.equal((await h.get('/api/library?id='+text)).status,404);assert.equal((await h.get('/api/library?id='+pdf)).status,404);
  const removed=await h.put({...emptyProgress(),read:[text],saved:[]},2);assert.equal(removed.status,200);assert.deepEqual((await removed.json()).payload.saved,[]);
 }finally{h.db.close()}
});
test('stale saves cannot overwrite a newer dynamic bookmark set and preserve the reconciliation payload',async()=>{
 const h=setup();try{
  const id=h.note();await h.put({...emptyProgress(),saved:[id]});const stale=await h.put(emptyProgress(),0);assert.equal(stale.status,409);assert.deepEqual((await stale.json()).payload.saved,[id]);assert.equal((await h.put({...emptyProgress(),saved:[id]},1)).status,200);
 }finally{h.db.close()}
});
test('library/lookup failures fail closed, while a pre-migration account can save ordinary progress',async()=>{
 const h=setup();try{
  const id=h.note();const failed={...h.env,DB:{prepare(){throw Error('Synthetic connection failure')}}};assert.equal((await libraryEndpoint(h.request(),failed)).status,503);assert.equal((await progressEndpoint(h.request('/api/progress','PUT',{payload:{...emptyProgress(),saved:[id]},version:0}),student,failed)).status,503);
  const legacy=new DatabaseSync(':memory:');legacy.exec(readFileSync('drizzle/0000_far_dust.sql','utf8'));const DB={prepare(sql){const statement=legacy.prepare(sql);return{bind(...values){return{async first(){return statement.get(...values)??null},async all(){return{results:statement.all(...values)}}}}}}};
  try{const response=await progressEndpoint(h.request('/api/progress','PUT',{version:0,payload:{...emptyProgress(),saved:['homophones-100','pdf-'+crypto.randomUUID()]}}),student,{...h.env,DB});assert.equal(response.status,200);assert.deepEqual((await response.json()).payload.saved,['homophones-100']);}finally{legacy.close()}
 }finally{h.db.close()}
});
