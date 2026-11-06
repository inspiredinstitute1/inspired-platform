// No remote targets or arguments. Disposable synthetic D1 + real local R2 only.
import './sites-env.mjs';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {syntheticPdf} from '../tests/fixtures/pdf.mjs';
assert.equal(process.argv.length,2,'No target overrides permitted');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const built=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
const binding=built.d1_databases.find(b=>b.binding==='DB');
assert.equal(binding.database_id,'00000000-0000-4000-8000-000000000000');
assert.equal(built.r2_buckets.find(b=>b.binding==='BUCKET').bucket_name,'site-creator-r2');
const root=mkdtempSync(resolve('.wrangler/pr3-storage-recovery-')),token=randomUUID();
function target(name){const dir=join(root,name);mkdirSync(dir);const config=join(dir,'wrangler.json');writeFileSync(config,JSON.stringify({name:'synthetic-local-recovery',main:resolve('scripts/fixtures/local-storage-recovery-worker.mjs'),compatibility_date:'2026-05-15',d1_databases:[binding],r2_buckets:[{binding:'BUCKET',bucket_name:'synthetic-recovery-only'}],vars:{REHEARSAL_TOKEN:token,PORTAL_ADMIN_EMAIL:'owner@example.test'}}));return{dir,config,state:join(dir,'.wrangler/state')};}
const source=target('source'),restored=target('restored');
function d1(target,args){const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1',...args,'--config',target.config,'--local'],{encoding:'utf8',timeout:45000,maxBuffer:20000000});assert.equal(r.status,0,r.stderr+r.stdout);return r.stdout;}
const schema=join(root,'schema.sql');writeFileSync(schema,['drizzle/0000_far_dust.sql',...readdirSync('docs/migrations').filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort().map(n=>'docs/migrations/'+n)].map(n=>readFileSync(n,'utf8')).join('\n'));
d1(source,['execute','DB','--file',schema,'--json']);
const base='http://127.0.0.1:8794';
const request=(path,options={})=>fetch(base+path,{...options,headers:{'x-rehearsal-token':token,origin:base,...options.headers},signal:AbortSignal.timeout(10000)});
async function withWorker(target,action){
 const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config',target.config,'--local','--persist-to',target.state,'--ip','127.0.0.1','--port','8794','--inspector-port','0'],{stdio:['ignore','pipe','pipe']});let logs='';
 try{
  await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Local startup timed out: '+logs.slice(-2000))),30000);const finish=fn=>v=>{clearTimeout(timer);fn(v);};worker.once('error',finish(no));worker.once('exit',finish(()=>no(Error('Worker exited: '+logs.slice(-2000)))));const output=c=>{logs+=c;if(logs.includes('Ready on '+base))finish(yes)();};worker.stdout.on('data',output);worker.stderr.on('data',output);});
  await action();
 }finally{worker.kill('SIGTERM');const timer=setTimeout(()=>worker.kill('SIGKILL'),3000);await new Promise(done=>{if(worker.exitCode!==null)done();else worker.once('exit',done);});clearTimeout(timer);}
}
const records=[],objects=[];
async function jsonPost(path,body,status=200){const r=await request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json();}
async function keys(){const result=[];let cursor=null;do{const r=await request('/storage'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert.equal(r.status,200);const page=await r.json();result.push(...page.keys);cursor=page.cursor;}while(cursor);return result.sort();}
const storagePath=key=>'/storage?key='+encodeURIComponent(key);
const put=async(object,bytes=object.bytes)=>{const r=await request(storagePath(object.key),{method:'PUT',headers:{'x-object-metadata':JSON.stringify(object.metadata)},body:bytes});assert.equal(r.status,201);};
await withWorker(source,async()=>{
 for(const status of ['draft','review','published','archived']){
  const form=new FormData();for(const [k,v] of Object.entries({title:'Synthetic '+status,category:'Recovery',reason:'Synthetic recovery fixture'}))form.append(k,v);form.append('file',new File([syntheticPdf()],status+'.pdf',{type:'application/pdf'}));
  const r=await request('/admin',{method:'POST',body:form});assert.equal(r.status,201);let record={...await r.json(),title:'Synthetic '+status,category:'Recovery',reason:'Synthetic status fixture'};
  if(status!=='draft')record={...record,...await jsonPost('/admin',{...record,status})};records.push({...record,status});
 }
 for(const key of await keys()){
  const r=await request(storagePath(key));assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer()),metadata=JSON.parse(r.headers.get('x-object-metadata'));assert.equal(sha(bytes),metadata.customMetadata.sha256);assert.equal(metadata.httpMetadata.contentType,'application/pdf');
  const file=objects.length+'.pdf';writeFileSync(join(root,file),bytes);objects.push({key,bytes,metadata,file,sha256:sha(bytes)});
 }
 assert.equal(objects.length,4);
});
const backup=join(root,'database.sql');d1(source,['export','DB','--output',backup]);d1(restored,['execute','DB','--file',backup,'--json']);
// Exact PDF metadata/history comparison, including immutable object keys and hashes.
const rows=target=>JSON.parse(d1(target,['execute','DB','--json','--command','SELECT * FROM pdf_materials ORDER BY id; SELECT * FROM pdf_audit ORDER BY id;'])).map(r=>r.results);
const recoveredRows=rows(restored);assert.deepEqual(recoveredRows,rows(source));
await withWorker(restored,async()=>{
 assert.deepEqual(await keys(),[],'Restore target must have no objects');
 for(const object of objects){const bytes=readFileSync(join(root,object.file));assert.equal(sha(bytes),object.sha256);await put(object,bytes);}
 assert.deepEqual(await keys(),objects.map(o=>o.key).sort());
 for(const object of objects){const r=await request(storagePath(object.key));assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.headers.get('x-object-metadata')),object.metadata);assert.equal(sha(Buffer.from(await r.arrayBuffer())),object.sha256);}
 for(const record of records){const r=await request('/files?id='+record.id);assert.equal(r.status,record.status==='published'?200:404);if(r.status===200)assert.deepEqual(new Uint8Array(await r.arrayBuffer()),syntheticPdf());const privateFile=await request('/private?id='+record.id);assert.equal(privateFile.status,200);assert.deepEqual(new Uint8Array(await privateFile.arrayBuffer()),syntheticPdf());}
 const published=records.find(r=>r.status==='published'),path='/files?id='+published.id;
 const dbRecord=recoveredRows[0].find(r=>r.id===published.id),object=objects.find(o=>o.key===dbRecord.object_key);
 const corrupt=Buffer.from(object.bytes);corrupt[30]^=1;await put(object,corrupt);assert.equal((await request(path)).status,503,'Same-sized corruption must fail closed');await jsonPost('/admin',{...published,status:'published'},409);
 await put(object);assert.equal((await request(path)).status,200);
 await request(storagePath(object.key),{method:'DELETE'});assert.equal((await request(path)).status,503);await put(object);
 await jsonPost('/pause',{enabled:false});assert.equal((await request(path)).status,503);assert.equal((await request('/private?id='+published.id)).status,200);
 await jsonPost('/pause',{enabled:true});assert.equal((await request(path)).status,200);
 await jsonPost('/admin',{...published,version:2,status:'archived'});assert.equal((await request(path)).status,404);assert.equal((await keys()).length,4);
});
writeFileSync(join(root,'manifest.json'),JSON.stringify({syntheticOnly:true,remote:false,databaseSHA256:sha(readFileSync(backup)),objects:objects.map(({bytes,...object})=>({...object,bytes:bytes.length})),exactBytesAndMetadata:true,exactPdfRowsAndAudits:true,privateStatusesPreserved:true,corruptAndMissingFailClosed:true,moduleAndArchiveGuards:true},null,2));
console.log('PASS local D1/R2 recovery: four PDFs; exact object keys, bytes, SHA-256, HTTP/custom metadata and PDF rows/audits; draft/review/archive privacy, corruption/missing-object rejection, module pause and archive guards.');
console.log('Recovery state: '+root);
console.log('Not tested: hosted D1/R2 recovery, concurrent traffic, provider authentication or browser/mobile sessions.');
