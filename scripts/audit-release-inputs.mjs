// Read-only candidate inventory. Never connects to hosted storage or deploys.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export function auditReleaseInputs(manifest,worker,migrations){
 assert(manifest.project_id,'Source Site identity missing');
 assert.equal(manifest.d1,'DB','Unexpected source D1 binding');
 assert.equal(manifest.r2,'BUCKET','Unexpected source R2 binding');
 assert(!manifest.static,'Worker application must not be packaged as a static-only Site');
 const databases=worker.d1_databases||[],buckets=worker.r2_buckets||[];
 assert.equal(databases.length,1,'Review unexpected D1 bindings');assert.equal(buckets.length,1,'Review unexpected R2 bindings');
 assert.equal(databases[0].binding,'DB');assert.equal(buckets[0].binding,'BUCKET');
 assert(!worker.vars?.FINANCE_REHEARSAL_MODE,'Hosted build must not enable the synthetic journal');
 assert(!worker.vars?.REHEARSAL_TOKEN,'Recovery fixture token must not enter the application build');
 assert(typeof worker.main==='string'&&worker.main.length>0&&!worker.main.includes('fixtures')&&!worker.main.includes('recovery'),'Application entry point must not be a recovery fixture');
 assert(migrations.length>0,'Explicit Admin migrations missing');
 const ordered=[...migrations].sort();
 ordered.forEach((name,index)=>assert.equal(Number(name.slice(0,4)),index+1,'Migration numbers must be unique and contiguous from 0001'));
 const localPlaceholder=databases[0].database_id==='00000000-0000-4000-8000-000000000000';
 return{localInputChecksPassed:true,projectId:manifest.project_id,explicitMigrations:ordered,bindings:{d1:databases[0].binding,r2:buckets[0].binding,localPlaceholder},hostedBindingAssignmentVerified:false,releaseApproved:false,releaseReady:false,pending:['Actual provider sign-in and gateway header protection','Browser/mobile/accessibility/PWA/two-device checks','Approved isolated staging target and target-specific bindings','Hosted D1/R2 migration and recovery checks','Owner approval for merge/deployment/DNS/live changes']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,2,'No target or remote arguments permitted');
 const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');assert.equal(resolve('.'),project,'Run from the project root');
 const manifest=JSON.parse(readFileSync('.openai/hosting.json','utf8')),worker=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
 const names=readdirSync('docs/migrations').filter(name=>/^\d{4}_.*\.sql$/.test(name));
 const report=auditReleaseInputs(manifest,worker,names),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const files=['.openai/hosting.json','dist/server/wrangler.json','drizzle/0000_far_dust.sql',...report.explicitMigrations.map(name=>'docs/migrations/'+name)];
 report.files=files.map(path=>({path,sha256:sha(readFileSync(path))}));
 const git=args=>{const result=spawnSync('git',args,{encoding:'utf8',timeout:10000});assert.equal(result.status,0,'Unable to inspect local source revision');return result.stdout.trim();};
 report.source={commit:git(['rev-parse','HEAD']),workingTreeClean:git(['status','--porcelain'])===''};
 mkdirSync('.wrangler',{recursive:true});const directory=mkdtempSync(resolve('.wrangler/pr3-release-inputs-'));
 writeFileSync(join(directory,'manifest.json'),JSON.stringify(report,null,2));
 console.log(`PASS local release input audit: base + ${report.explicitMigrations.length} explicit migrations; source/build storage bindings agree; rehearsal flags absent.`);
 console.log('Manifest: '+join(directory,'manifest.json'));
 console.log('RELEASE BLOCKED: provider/browser/staging/hosted-recovery verification and owner approval remain pending. This command runs no tests, migrations or deployment.');
}
