// Disposable local D1 only. Never accepts a target, credential or remote flag.
import './sites-env.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(process.argv.length,2,'This rehearsal accepts no arguments or remote targets');
const built=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
const binding=built.d1_databases?.find(item=>item.binding==='DB');
assert.equal(binding?.database_id,'00000000-0000-4000-8000-000000000000','Only the placeholder database is permitted');
const run=(args)=>{const result=spawnSync(process.execPath,args,{encoding:'utf8',timeout:45000,maxBuffer:20000000});if(result.status!==0)throw Error((result.error?.message||'')+'\n'+result.stderr+'\n'+result.stdout);return result.stdout;};
const seed=run(['scripts/validate-local-d1.mjs']),match=seed.match(/Local-only validation state: (.+)/);assert(match,'Fresh synthetic seed directory missing');
const seedDir=resolve(match[1]);assert(seedDir.startsWith(resolve('.wrangler/pr3-validation-')));
const root=mkdtempSync(resolve('.wrangler/pr3-recovery-'));
function target(name){const directory=join(root,name);mkdirSync(directory);const config=join(directory,'wrangler.json');writeFileSync(config,JSON.stringify({name:'inspired-pr3-local-recovery',compatibility_date:'2026-05-15',d1_databases:[binding]}));return{directory,config,state:join(directory,'.wrangler/state')};}
const source=target('source'),restored=target('restored'),rollback=target('rollback');
mkdirSync(join(source.state,'v3'),{recursive:true});cpSync(join(seedDir,'v3/d1'),join(source.state,'v3/d1'),{recursive:true});
const cli=(target,args)=>run(['node_modules/wrangler/bin/wrangler.js','d1',...args,'--config',target.config,'--local']);
function execute(target,sql){const data=JSON.parse(cli(target,['execute','DB','--json','--command',sql]));assert(data.every(item=>item.success));return data.map(item=>item.results);}
function snapshot(target){
 const objects=execute(target,"SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name")[0],tables=objects.filter(item=>item.type==='table');
 for(const table of tables)assert(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table.name));
 const results=execute(target,tables.map(table=>`SELECT * FROM "${table.name}";`).join('\n')),rows={};tables.forEach((table,index)=>{rows[table.name]=results[index].map(row=>JSON.stringify(row)).sort();});
 assert.deepEqual(execute(target,'PRAGMA foreign_key_check;')[0],[]);
 // D1 intentionally rejects integrity_check. Run it read-only on the disposable
 // SQLite store only after the local CLI process has closed its connections.
 const databaseDir=join(target.state,'v3/d1/miniflare-D1DatabaseObject'),databases=readdirSync(databaseDir).filter(name=>/^[a-f0-9]{64}\.sqlite$/.test(name));assert.equal(databases.length,1);
 const local=new DatabaseSync(join(databaseDir,databases[0]),{readOnly:true});try{assert.equal(local.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{local.close();}
 return{objects,rows};
}
function guards(target){for(const sql of ['DELETE FROM finance_approval_snapshots','UPDATE finance_verification_events SET reason=reason','DELETE FROM portal_module_audit','UPDATE governance_audit SET reason=reason']){assert.throws(()=>execute(target,sql),/Retain|append-only|immutable/);}execute(target,"UPDATE portal_modules SET enabled=0,version=version+1,changed_by='synthetic-recovery',change_reason='Synthetic restored practice guard check',updated_at=3 WHERE module_key='practice';");assert.throws(()=>execute(target,"UPDATE learner_progress SET payload='{\"attempts\":[{}],\"drafts\":{}}' WHERE user_id='synthetic-learner'"),/Practice is paused/);}
execute(source,"UPDATE portal_modules SET enabled=0,show_navigation=0,version=version+1,changed_by='synthetic-recovery',change_reason='Synthetic pre-backup module setting',updated_at=1 WHERE module_key='library';");
const before=snapshot(source),backup=join(root,'synthetic-backup.sql');
cli(source,['export','DB','--output',backup]);const backupHash=sha(readFileSync(backup));assert(readFileSync(backup).length>0);
cli(restored,['execute','DB','--json','--file',backup]);assert.deepEqual(snapshot(restored),before,'Export/import must preserve all application records, audits and SQL objects exactly');
// Reapply explicit migrations after recovery; defaults must not overwrite state.
const reapply=join(root,'reapply.sql');writeFileSync(reapply,readdirSync('docs/migrations').filter(name=>/^\d{4}_.*\.sql$/.test(name)).sort().map(name=>readFileSync('docs/migrations/'+name,'utf8')).join('\n'));
cli(restored,['execute','DB','--json','--file',reapply]);assert.deepEqual(snapshot(restored),before,'Migration reapplication must preserve restored records/audits');
// Simulate post-backup changes in the disposable source and recover the retained
// checkpoint into a THIRD empty target. Never overwrite an existing database.
execute(source,"UPDATE portal_modules SET enabled=1,show_navigation=1,version=version+1,changed_by='synthetic-recovery',change_reason='Synthetic post-backup change',updated_at=2 WHERE module_key='library';");assert.notDeepEqual(snapshot(source),before);
cli(rollback,['execute','DB','--json','--file',backup]);assert.deepEqual(snapshot(rollback),before,'Recovery checkpoint must exclude post-backup changes');assert.equal(sha(readFileSync(backup)),backupHash,'Retained backup changed');
guards(restored);guards(rollback);
writeFileSync(join(root,'manifest.json'),JSON.stringify({syntheticOnly:true,remote:false,backupSHA256:backupHash,tables:Object.fromEntries(Object.entries(before.rows).map(([name,rows])=>[name,{rows:rows.length,sha256:sha(JSON.stringify(rows))}])),schemaObjects:before.objects.length,exactRoundTrip:true,reapplicationPreserved:true,checkpointRecovery:true,restoredGuards:true},null,2));
console.log(`PASS local D1 recovery: ${Object.keys(before.rows).length} tables; exact rows/schema/audits, integrity, reapplication, immutable/practice guards and checkpoint restore into empty targets.`);
console.log('Synthetic local backup SHA-256: '+backupHash);
console.log('Recovery state: '+root);
console.log('Not tested: hosted D1/time-travel, production rollback, R2 recovery, provider/browser/mobile sessions.');
