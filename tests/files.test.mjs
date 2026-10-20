import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminFilesEndpoint,filesEndpoint,MAX_PDF_BYTES} from '../lib/file-service.mjs';
import {resourceEndpoint,publicProgrammeResources} from '../lib/resource-service.mjs';
import {syntheticPdf} from './fixtures/pdf.mjs';
const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql',...['0004_content_manager','0005_programme_resources','0010_pdf_materials'].map(name=>`docs/migrations/${name}.sql`)])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()}};
 const objects=new Map(),operations=[];
 const BUCKET={async put(key,value,options){operations.push(['put',key]);const record={bytes:new Uint8Array(value),size:value.byteLength,...options};objects.set(key,record);return record;},async delete(key){operations.push(['delete',key]);objects.delete(key)},async head(key){return objects.get(key)??null},async get(key){const record=objects.get(key);return record?{...record,body:new Blob([record.bytes]).stream()}:null}};
 const env={DB,BUCKET,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test',path='/api/admin/files')=>new Request('https://local.test'+path,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>adminFilesEndpoint(request(method,body,origin),user,env);
 function uploadRequest({bytes=syntheticPdf(),name='synthetic.pdf',type='application/pdf',...fields}={}){const form=new FormData();for(const [key,value] of Object.entries({title:'Synthetic PDF',category:'Grammar',reason:'Upload synthetic PDF',...fields}))form.append(key,value);form.append('file',new File([bytes],name,{type}));return new Request('https://local.test/api/admin/files',{method:'POST',headers:{origin:'https://local.test'},body:form});}
 const upload=(options={},user=owner)=>adminFilesEndpoint(uploadRequest(options),user,env);
 async function create(){const r=await upload();assert.equal(r.status,201,await r.clone().text());return{...await r.json(),title:'Synthetic PDF',category:'Grammar',reason:'Review synthetic PDF'};}
 const download=(id,{admin=false,user=admin?owner:null}={})=>filesEndpoint(request('GET',undefined,undefined,'/api/files'+(id?'?id='+encodeURIComponent(id):'')),user,env,{admin});
 return{db,DB,BUCKET,objects,operations,env,request,call,uploadRequest,upload,create,download};
}
test('PDF manager and private downloads require Admin; uploads reject foreign origins before touching storage',async()=>{
 const h=setup();try{
  for(const user of [null,student]){assert.equal((await h.call(undefined,user)).status,403);assert.equal((await h.upload({},user)).status,403);assert.equal((await h.download('pdf-'+crypto.randomUUID(),{admin:true,user})).status,403);}
  const request=h.uploadRequest();request.headers.set('origin','https://other.test');assert.equal((await adminFilesEndpoint(request,owner,h.env)).status,403);
  assert.equal((await h.call({},owner,'DELETE')).status,405);assert.equal(h.objects.size,0);
 }finally{h.db.close()}
});
test('PDF upload enforces file size, filename/MIME, signature/footer and valid text fields',async()=>{
 const h=setup();try{
  for(const [options,status] of [[{bytes:new Uint8Array(MAX_PDF_BYTES+1)},413],[{bytes:new Uint8Array(10)},413],[{name:'synthetic.html'},415],[{type:'text/html'},415],[{bytes:new TextEncoder().encode('<html>'+ 'x'.repeat(50)+'%%EOF')},415],[{bytes:new TextEncoder().encode('%PDF-1.4\n'+'x'.repeat(50))},415],[{title:''},400],[{reason:'ab'},400]])assert.equal((await h.upload(options)).status,status,JSON.stringify({...options,bytes:undefined}));
  assert.equal(h.objects.size,0);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM pdf_materials').get().n,0);
 }finally{h.db.close()}
});
test('uploaded PDFs remain private drafts regardless of forged status/key; published downloads are bytes with safe headers',async()=>{
 const h=setup();try{
  const r=await h.upload({status:'published',object_key:'public/forged.pdf',actorId:'spoof'});assert.equal(r.status,201);const note={...await r.json(),title:'Synthetic PDF',category:'Grammar',reason:'Publish checked PDF'};
  assert.equal((await h.download(note.id)).status,404);assert.equal((await(await h.download()).json()).files.length,0);
  const privateFile=await h.download(note.id,{admin:true});assert.equal(privateFile.status,200);assert.deepEqual(new Uint8Array(await privateFile.arrayBuffer()),syntheticPdf());
  assert.equal((await h.call({...note,status:'published'})).status,200);const publicFile=await h.download(note.id);assert.equal(publicFile.status,200);assert.equal(publicFile.headers.get('content-type'),'application/pdf');assert.match(publicFile.headers.get('content-disposition'),/^attachment; filename="InspirED-pdf-/);assert.match(publicFile.headers.get('cache-control'),/no-store/);assert.equal(publicFile.headers.get('x-content-type-options'),'nosniff');assert.match(publicFile.headers.get('content-security-policy'),/sandbox/);
  assert.deepEqual(new Uint8Array(await publicFile.arrayBuffer()),syntheticPdf());const list=(await(await h.download()).json()).files;assert.equal(list.length,1);for(const field of ['object_key','sha256','fileName','changed_by','reason','version','status'])assert(!(field in list[0]));
  const stored=h.db.prepare('SELECT * FROM pdf_materials').get();assert(!stored.object_key.includes('forged'));assert.equal(stored.status,'published');assert.equal(stored.sha256.length,64);assert.equal(h.db.prepare('SELECT actor_id FROM pdf_audit LIMIT 1').get().actor_id,'owner');
 }finally{h.db.close()}
});
test('PDF programme links require publication and archive removes discovery/download without deleting file or history',async()=>{
 const h=setup();try{
  const node=crypto.randomUUID();h.db.prepare("INSERT INTO content_nodes(id,kind,title,status,changed_by,change_reason,updated_at) VALUES(?,'division','PDF course catalogue','published','owner','Synthetic setup',1)").run(node);
  const note=await h.create();assert.equal((await resourceEndpoint(h.request('POST',{nodeId:node,kind:'note',resourceId:note.id,enabled:true,sortOrder:1,reason:'Link PDF draft'}),owner,h.env)).status,201);
  assert.equal((await publicProgrammeResources(h.DB)).length,0);await h.call({...note,status:'published'});const links=await publicProgrammeResources(h.DB);assert.equal(links.length,1);assert.equal(links[0].href,'#/pdf/'+note.id);
  await h.call({...note,version:2,status:'archived'});assert.equal((await publicProgrammeResources(h.DB)).length,0);assert.equal((await h.download(note.id)).status,404);assert.equal(h.objects.size,1);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_resources').get().n,1);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM pdf_audit').get().n,3);
 }finally{h.db.close()}
});
test('PDF metadata conflicts and immutable file identity retain optimistic versions and append-only audit',async()=>{
 const h=setup();try{
  const note=await h.create();assert.equal((await h.call({...note,status:'review'})).status,200);assert.equal((await h.call({...note,status:'published'})).status,409);
  assert.throws(()=>h.db.exec("UPDATE pdf_materials SET object_key='replacement'"),/immutable/);assert.throws(()=>h.db.exec('DELETE FROM pdf_materials'),/Archive PDFs/);assert.throws(()=>h.db.exec('DELETE FROM pdf_audit'),/append-only/);assert.throws(()=>h.db.exec("UPDATE pdf_audit SET reason='tamper'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0010_pdf_materials.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM pdf_audit').get().n,2);
  const admin=await(await h.call()).json();assert.equal(admin.files.length,1);assert(!JSON.stringify(admin).includes('object_key'));assert(!JSON.stringify(admin).includes('sha256'));
 }finally{h.db.close()}
});
test('failed object or atomic metadata/audit writes do not expose a partial upload; cleanup targets only the newly generated private object',async()=>{
 for(const failure of ['put','audit','cleanup']){
  const h=setup();try{
   if(failure==='put')h.BUCKET.put=async()=>{throw Error('Synthetic R2 failure')};else h.db.exec("CREATE TRIGGER reject_pdf_audit BEFORE INSERT ON pdf_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
   if(failure==='cleanup')h.BUCKET.delete=async()=>{throw Error('Synthetic cleanup failure')};
   assert.equal((await h.upload()).status,503);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM pdf_materials').get().n,0);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM pdf_audit').get().n,0);assert.equal((await(await h.download()).json()).files.length,0);
   assert.equal(h.objects.size,failure==='cleanup'?1:0);if(failure==='audit')assert.deepEqual(h.operations.map(item=>item[0]),['put','delete']);
  }finally{h.db.close()}
 }
});
test('download rechecks publication after storage fetch; missing or mismatched objects cannot be published or downloaded',async()=>{
 const h=setup();try{
  const note=await h.create(),key=[...h.objects.keys()][0],object=h.objects.get(key);object.customMetadata.sha256='wrong';assert.equal((await h.call({...note,status:'published'})).status,409);assert.equal((await h.download(note.id,{admin:true})).status,503);
  object.customMetadata.sha256=h.db.prepare('SELECT sha256 FROM pdf_materials').get().sha256;await h.call({...note,status:'published'});
  const get=h.BUCKET.get;h.BUCKET.get=async key=>{const object=await get(key);h.db.exec("UPDATE pdf_materials SET status='archived',version=version+1,change_reason='Archive during download'");return object;};assert.equal((await h.download(note.id)).status,404);
 }finally{h.db.close()}
});
test('PDF storage absence fails closed for upload, publication and download while metadata can still be archived',async()=>{
 const h=setup();try{
  const note=await h.create();delete h.env.BUCKET;assert.equal((await h.upload()).status,503);assert.equal((await h.call({...note,status:'published'})).status,503);assert.equal((await h.download(note.id,{admin:true})).status,503);assert.equal((await h.call({...note,status:'archived'})).status,200);
 }finally{h.db.close()}
});

test('same-sized corrupt bytes with retained SHA metadata cannot be published or downloaded',async()=>{
 const h=setup();try{
  const note=await h.create(),object=[...h.objects.values()][0],original=object.bytes.slice();
  object.bytes[30]^=1;
  assert.equal((await h.call({...note,status:'published'})).status,409);
  assert.equal((await h.download(note.id,{admin:true})).status,503);
  assert.equal(h.db.prepare('SELECT version FROM pdf_materials').get().version,1);
  object.bytes=original;assert.equal((await h.call({...note,status:'published'})).status,200);
  object.bytes=original.slice();object.bytes[30]^=1;
  assert.equal((await h.download(note.id)).status,503);
 }finally{h.db.close()}
});
test('PDF reads reject truncated, excessive and failed streams before returning bytes',async()=>{
 for(const failure of ['short','long','error']){
  const h=setup();try{
   const note=await h.create(),get=h.BUCKET.get;let cancelled=false;
   h.BUCKET.get=async key=>{const object=await get(key);object.body=new ReadableStream({start(controller){if(failure==='error'){controller.error(Error('Synthetic read failure'));return;}controller.enqueue(new Uint8Array(object.size+(failure==='long'?1:-1)));if(failure==='short')controller.close();},cancel(){cancelled=true;}});return object;};
   assert.equal((await h.download(note.id,{admin:true})).status,503);
   if(failure==='long')assert(cancelled);
  }finally{h.db.close()}
 }
});
