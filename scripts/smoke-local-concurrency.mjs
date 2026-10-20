// Small bounded concurrency rehearsal, not a hosted capacity/latency guarantee.
import './sites-env.mjs';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {syntheticPdf} from '../tests/fixtures/pdf.mjs';
assert.equal(process.argv.length,2,'No remote targets or load overrides accepted');
const config=resolve('dist/server/wrangler.json'),built=JSON.parse(readFileSync(config,'utf8'));
assert.equal(built.d1_databases.find(b=>b.binding==='DB')?.database_id,'00000000-0000-4000-8000-000000000000');
assert.equal(built.r2_buckets.find(b=>b.binding==='BUCKET')?.bucket_name,'site-creator-r2');
const state=mkdtempSync(resolve('.wrangler/pr3-concurrency-')),schema=join(state,'schema.sql');
const files=['drizzle/0000_far_dust.sql',...readdirSync('docs/migrations').filter(n=>/^\d{4}_.*\.sql$/.test(n)).sort().map(n=>'docs/migrations/'+n)];
writeFileSync(schema,files.map(f=>readFileSync(f,'utf8')).join('\n'));
const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--config',config,'--local','--persist-to',state,'--file',schema,'--json'],{encoding:'utf8',timeout:45000,maxBuffer:20000000});assert.equal(migration.status,0,migration.stderr);assert(JSON.parse(migration.stdout).every(r=>r.success));
const base='http://127.0.0.1:8796',owner={id:'synthetic-load-owner',email:'load-owner@example.test'};
const people=Array.from({length:25},(_,index)=>({id:'synthetic-load-'+index,email:'load-'+index+'@example.test',index}));
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config',config,'--local','--persist-to',state,'--ip','127.0.0.1','--port','8796','--inspector-port','0','--var','PORTAL_ADMIN_EMAIL:'+owner.email],{stdio:['ignore','pipe','pipe']});
let logs='',requests=0,phase='startup';const latencies=[];
async function pool(items,limit,action){let next=0;const results=await Promise.allSettled(Array.from({length:Math.min(limit,items.length)},async()=>{while(next<items.length){const index=next++;await action(items[index],index);}}));for(const result of results)if(result.status==='rejected')throw result.reason;}
async function fetchAs(path,user,options={}){requests++;return fetch(base+path,{...options,headers:{origin:base,...(user?{'oai-authenticated-user-id':user.id,'oai-authenticated-user-email':user.email,'x-portal-account-id':encodeURIComponent(user.id)}:{}),...options.headers},signal:AbortSignal.timeout(20000)});}
async function progress(person,body){const start=performance.now(),response=await fetchAs('/api/progress',person,body?{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});assert.match(response.headers.get('cache-control')||'',/no-store/);const data=await response.json();latencies.push(performance.now()-start);return{status:response.status,data};}
const payload=person=>({profile:{name:'Synthetic '+person.index,exam:'GPSTR'},read:[],saved:[],watched:[],attempts:[],drafts:{},activity:{},goal:3+person.index%5,customNotes:[]});
try{
 await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Local Worker startup timed out: '+logs.slice(-2000))),30000);const finish=fn=>value=>{clearTimeout(timer);fn(value);};worker.once('error',finish(no));worker.once('exit',finish(()=>no(Error('Local Worker exited: '+logs.slice(-2000)))));const output=chunk=>{logs+=chunk;if(logs.includes('Ready on '+base))finish(yes)();};worker.stdout.on('data',output);worker.stderr.on('data',output);});
 phase='initial saves';console.log('Checking '+phase);
 await pool(people,5,async person=>{const saved=await progress(person,{version:0,payload:payload(person)});assert.equal(saved.status,200);assert.equal(saved.data.version,1);assert.equal(saved.data.user.id,person.id);});
 phase='isolated reads';console.log('Checking '+phase);
 await pool(people,5,async person=>{const saved=await progress(person);assert.equal(saved.status,200);assert.equal(saved.data.payload.profile.name,'Synthetic '+person.index);assert.equal(saved.data.payload.goal,payload(person).goal);});
 // Two in-flight writers for each of two active accounts at a time: four requests.
 phase='optimistic conflicts';console.log('Checking '+phase);
 await pool(people,2,async person=>{
  const responses=await Promise.all([progress(person,{version:1,payload:{...payload(person),goal:6}}),progress(person,{version:1,payload:{...payload(person),goal:7}})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const winner=responses.find(r=>r.status===200).data;
  const current=await progress(person);assert.equal(current.data.version,2);assert.equal(current.data.payload.goal,winner.payload.goal);assert.equal(current.data.payload.profile.name,'Synthetic '+person.index);
 });
 // Four simultaneous maximum-size PDF reads, verifying actual returned bytes.
 phase='maximum-size PDF upload/publication';console.log('Checking '+phase);
 const sample=new TextDecoder().decode(syntheticPdf()),prefix=new TextEncoder().encode(sample.slice(0,sample.lastIndexOf('%%EOF'))+'%');
 const pdf=new Uint8Array(5*1024*1024).fill(32);pdf.set(prefix);pdf.set(new TextEncoder().encode('\n%%EOF\n'),pdf.length-7);
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),expectedHash=hash(pdf),form=new FormData();
 for(const [key,value] of Object.entries({title:'Synthetic maximum-size PDF',category:'Local load',reason:'Bounded local concurrency fixture'}))form.append(key,value);form.append('file',new File([pdf],'synthetic-max.pdf',{type:'application/pdf'}));
 const uploaded=await fetchAs('/api/admin/files',owner,{method:'POST',body:form});assert.equal(uploaded.status,201);const note=await uploaded.json();
 const published=await fetchAs('/api/admin/files',owner,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...note,title:'Synthetic maximum-size PDF',category:'Local load',status:'published',reason:'Synthetic local publication'})});assert.equal(published.status,200);await published.arrayBuffer();
 phase='maximum-size PDF concurrent reads';console.log('Checking '+phase);
 await pool([1,2,3,4],4,async()=>{const response=await fetchAs('/api/files?id='+note.id,null);assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,pdf.length);assert.equal(hash(bytes),expectedHash);});
 phase='oversized rejection and recovery';console.log('Checking '+phase);
 const rejected=await fetchAs('/api/progress',people[0],{method:'PUT',headers:{'content-type':'application/json'},body:'x'.repeat(2000001)});assert.equal(rejected.status,413);await rejected.arrayBuffer();
 const healthy=await progress(people[0]);assert.equal(healthy.status,200);assert.equal(healthy.data.version,2);
 assert(!/Can't read from request stream|The script will never generate a response|Memory limit would be exceeded/i.test(logs),logs.slice(-2000));
 const sorted=[...latencies].sort((a,b)=>a-b),percentile=p=>Math.round(sorted[Math.ceil(sorted.length*p)-1]);
 const report={syntheticOnly:true,remote:false,accounts:25,maxProgressConcurrency:5,conflictingAccounts:25,pdfBytes:pdf.length,simultaneousPdfReads:4,requests,progressSamples:latencies.length,localLatencyMs:{p50:percentile(.5),p95:percentile(.95),max:Math.round(sorted.at(-1))},isolated:true,optimisticConflicts:true,exactPdfBytes:true,rejectionRecovery:true,hostedCapacityVerified:false};
 writeFileSync(join(state,'manifest.json'),JSON.stringify(report,null,2));console.log('PASS bounded local concurrency: 25 isolated synthetic accounts; every paired stale write yields one save/one conflict; four simultaneous 5 MiB PDF reads preserve exact SHA-256; oversized-request rejection recovers.');console.log(JSON.stringify(report));console.log('Evidence: '+state);console.log('Not measured: hosted CPU/memory/quotas, real traffic capacity, provider sign-in or browser behaviour.');
}catch(error){throw new Error('Local concurrency failed during '+phase+': '+error.message+'\n'+logs.slice(-2000),{cause:error});}finally{worker.kill('SIGTERM');const timer=setTimeout(()=>worker.kill('SIGKILL'),3000);await new Promise(done=>{if(worker.exitCode!==null)done();else worker.once('exit',done);});clearTimeout(timer);}
