// Development only: unique local state, placeholder database ID, no remote option.
import './sites-env.mjs';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const config=resolve('dist/server/wrangler.json');
const binding=JSON.parse(readFileSync(config,'utf8')).d1_databases?.find(x=>x.binding==='DB');
assert.equal(binding?.database_id,'00000000-0000-4000-8000-000000000000','Only the local placeholder database is allowed');
mkdirSync('.wrangler',{recursive:true});
const dir=mkdtempSync(resolve('.wrangler/pr3-validation-'));
const files=['drizzle/0000_far_dust.sql',...['0001_social_links','0002_community_membership','0003_finance_reconciliation','0004_content_manager','0005_programme_resources','0006_programme_enrolments'].map(n=>`docs/migrations/${n}.sql`)];
const sql=files.map(f=>readFileSync(f,'utf8'));
const migration=join(dir,'validation.sql');
writeFileSync(migration,sql.join('\n')+`
INSERT INTO community_groups(platform,title,access_tier,updated_at) VALUES('telegram','Synthetic validation group','free',1);
INSERT INTO community_memberships(group_id,learner_id,membership_status,payment_status,updated_at) VALUES(1,'synthetic-local-only','pending','free',1);
INSERT INTO social_links(platform,label,url,updated_at) VALUES('website','Synthetic','https://example.test',1);
INSERT INTO finance_transactions(source,external_reference,transaction_kind,gross_paise,net_paise,paid_at,imported_at) VALUES('cash','synthetic-local-only','tuition',100,100,'2026-10-19',1);
INSERT INTO content_nodes(id,kind,title,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000001','division','Synthetic local division','synthetic-owner','Validate migration',1);
INSERT INTO programme_resources(id,node_id,resource_kind,resource_id,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','note','synthetic-local-only','synthetic-owner','Validate resource migration',1);
INSERT INTO content_nodes(id,kind,parent_id,title,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000003','course','00000000-0000-4000-8000-000000000001','Synthetic course','synthetic-owner','Validate enrolment migration',1);
INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES('synthetic-learner','learner@example.test','Synthetic learner','Student','{}',1,1);
INSERT INTO programme_enrolments(id,node_id,learner_id,status,starts_at,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','synthetic-learner','pending',0,'synthetic-owner','Validate enrolment migration',1);
`+sql.slice(1).join('\n'));
function execute(args){
 const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--config',config,'--local','--persist-to',dir,'--json',...args],{encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);
 const result=JSON.parse(r.stdout);assert(result.every(x=>x.success));return result;
}
execute(['--file',migration]);
const checks=execute(['--command',`PRAGMA foreign_key_check; SELECT (SELECT COUNT(*) FROM community_groups) AS groups, (SELECT COUNT(*) FROM community_memberships) AS members, (SELECT COUNT(*) FROM social_links) AS links, (SELECT COUNT(*) FROM finance_transactions) AS transactions, (SELECT COUNT(*) FROM content_nodes) AS nodes, (SELECT COUNT(*) FROM content_audit) AS audits, (SELECT COUNT(*) FROM programme_resources) AS resourceLinks, (SELECT COUNT(*) FROM resource_audit) AS resourceAudits, (SELECT COUNT(*) FROM programme_enrolments) AS enrolments, (SELECT COUNT(*) FROM enrolment_audit) AS enrolmentAudits;`]);
assert.deepEqual(checks[0].results,[]);
assert.deepEqual(checks[1].results[0],{groups:1,members:1,links:1,transactions:1,nodes:2,audits:2,resourceLinks:1,resourceAudits:1,enrolments:1,enrolmentAudits:1});
console.log('PASS local D1: base + six migrations, reapplication preserves synthetic records, foreign keys and row counts.');
console.log(`Local-only validation state: ${dir}`);
