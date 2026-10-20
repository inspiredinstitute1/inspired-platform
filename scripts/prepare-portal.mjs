import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
fs.mkdirSync('public',{recursive:true});
for(const name of ['style.css','theme.css'])fs.copyFileSync('portal/'+name,'public/'+name);
fs.cpSync('portal/assets','public/assets',{recursive:true});
const shell=fs.readFileSync('portal/index.html','utf8').split('<body>')[1].split('</body>')[0];
fs.writeFileSync('lib/portal-shell.ts','export const portalShell = '+JSON.stringify(shell)+';\n');
const migrationFiles=fs.readdirSync('docs/migrations').filter(name=>/^\d{4}_.*\.sql$/.test(name)).sort();
const schemaFiles=['drizzle/0000_far_dust.sql',...migrationFiles.map(name=>'docs/migrations/'+name)];
const schemaObjects=new Map(),schemaHash=createHash('sha256');
for(const path of schemaFiles){const sql=fs.readFileSync(path,'utf8');schemaHash.update(path+'\n'+sql+'\n');for(const match of sql.matchAll(/CREATE\s+(TABLE|INDEX|TRIGGER|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z_][a-zA-Z0-9_]*)["`]?/gi)){const type=match[1].toLowerCase(),name=match[2];schemaObjects.set(type+':'+name,{type,name});}}
fs.writeFileSync('lib/operations-catalogue.json',JSON.stringify({migrationCount:migrationFiles.length,fingerprint:schemaHash.digest('hex'),objects:[...schemaObjects.values()].sort((a,b)=>(a.type+':'+a.name).localeCompare(b.type+':'+b.name))}));
const app=fs.readFileSync('portal/app.js','utf8');
const data=app.slice(app.indexOf('const NOTES='),app.indexOf("const boot=window"));
const c=vm.createContext({});
for(const f of ['catalogue.js','homophones.js','mock-test-7.js'])vm.runInContext(fs.readFileSync('portal/'+f,'utf8'),c);
vm.runInContext(data,c);
const bank=JSON.parse(vm.runInContext('JSON.stringify({tests:TESTS,notes:NOTES.map(n=>n.id),videos:VIDEOS.map(v=>v.id)})',c));
fs.writeFileSync('lib/portal-catalogue.json',JSON.stringify(bank));
const resources=JSON.parse(vm.runInContext(`JSON.stringify([
 ...NOTES.map(n=>({kind:'note',id:n.id,title:n.title,href:'#/notes/'+encodeURIComponent(n.id)})),
 ...VIDEOS.map(v=>({kind:'video',id:v.id,title:v.title,href:'#/videos/'+encodeURIComponent(v.id)})),
 ...TESTS.map(t=>({kind:'test',id:t.id,title:t.title,href:'#/test/'+encodeURIComponent(t.id)}))
])`,c));
fs.writeFileSync('lib/resource-catalogue.json',JSON.stringify(resources));
const boot=fs.readFileSync('portal/account-contract.js','utf8')+'\n'+fs.readFileSync('portal/cloud-boot.js','utf8');
fs.writeFileSync('public/portal.bundle.js','(async function(){\n'+boot+'\n'+['catalogue.js','homophones.js','mock-test-7.js','admin-ui.js','module-navigation.js','module-admin.js','operations-admin.js','material-admin.js','file-admin.js','content-admin.js','resource-admin.js','enrolment-admin.js','faculty-admin.js','faculty-notes.js','social-admin.js','community-admin.js','governance-admin.js','finance-admin.js','finance-import-admin.js','finance-review-admin.js','finance-ledger-admin.js','finance-evidence-admin.js','finance-payment-links-admin.js','finance-approvals-admin.js','finance-verification-admin.js','learning-library.js','exams.js','exam-analytics.js','exam-admin.js','app.js','cloud-sync.js'].map(f=>fs.readFileSync('portal/'+f,'utf8')).join('\n;\n')+'\n})();');
console.log('Prepared retained portal assets, shell, script bundle and scoring catalogue.');
