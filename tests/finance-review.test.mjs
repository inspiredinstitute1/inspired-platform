import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {financeImportsEndpoint} from '../lib/finance-import-service.mjs';
import {financeReviewEndpoint} from '../lib/finance-review-service.mjs';
const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of ['drizzle/0000_far_dust.sql','docs/migrations/0003_finance_reconciliation.sql','docs/migrations/0011_finance_import_staging.sql','docs/migrations/0004_content_manager.sql','docs/migrations/0006_programme_enrolments.sql','docs/migrations/0012_finance_review.sql'])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const row={source:'phonepe',externalReference:'SYNTHETIC-1',studentId:'claimed-student',courseCode:'HSTR',transactionKind:'tuition',grossPaise:99900,feePaise:0,netPaise:99900,paidAt:'2026-10-19'};
 const body=(rows=[row],changes={})=>({requestId:crypto.randomUUID(),sourceLabel:'Synthetic mapped export',reason:'Review synthetic import',format:'json',data:JSON.stringify(rows),...changes});
 const request=(method='GET',body,origin='https://local.test',path='/api/admin/finance-imports')=>new Request('https://local.test'+path,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>financeImportsEndpoint(request(method,body,origin),user,env);
 const review=(data,user=owner,method=data?'POST':'GET',origin)=>financeReviewEndpoint(request(method,data,origin,'/api/admin/finance-review'),user,env);
 const ready=async()=>{const imported=await(await call(body([row,row,{...row,externalReference:'BAD',netPaise:1}]))).json();db.exec("INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES('student','student@example.test','Synthetic student','Student','{}',1,1),('owner','owner@example.test','Owner','Student','{}',1,1); INSERT INTO content_nodes(id,kind,parent_id,title,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000001','division',NULL,'Synthetic division','owner','Synthetic setup',1),('00000000-0000-4000-8000-000000000002','course','00000000-0000-4000-8000-000000000001','Synthetic course','owner','Synthetic setup',1);");return{rowId:imported.batchId+':1',version:0,learnerId:'student',nodeId:'00000000-0000-4000-8000-000000000002',status:'reviewed',evidenceReference:'Synthetic receipt reference',evidenceNotes:'Synthetic evidence only',reason:'Synthetic review'};};
 return{db,DB,env,row,body,request,call,review,ready};
}
test('review API requires Admin, same origin and bounded JSON; review history cannot be deleted',async()=>{
 const h=setup();try{const body=await h.ready();for(const user of [null,student])for(const data of [undefined,body])assert.equal((await h.review(data,user)).status,403);assert.equal((await h.review(body,owner,'POST','https://other.test')).status,403);assert.equal((await h.review({},owner,'DELETE')).status,405);assert.equal((await h.review({...body,evidenceNotes:'ಕ'.repeat(3000)})).status,413);assert.match((await h.review()).headers.get('cache-control'),/no-store/);}finally{h.db.close()}
});
test('matches are manual; reviewed records remain unverified and audit server actor with no ledger or access writes',async()=>{
 const h=setup();try{const body=await h.ready();let data=await(await h.review()).json();assert.equal(data.rows.length,1);assert.equal(data.rows[0].learnerId,null);assert.equal(data.rows[0].nodeId,null);assert.equal(data.rows[0].version,0);assert.deepEqual(data.learners.map(row=>row.id),['student']);assert.equal(data.programmes.length,1);
 assert.equal((await h.review({...body,changedBy:'spoof',verification:'verified'})).status,201);data=await(await h.review()).json();assert.equal(data.rows[0].status,'reviewed');assert.equal(data.rows[0].version,1);assert.equal(data.verification,'unverified');assert(data.stagingOnly);assert.equal(data.audit[0].actorId,'owner');assert.equal(JSON.parse(data.audit[0].nextJson).learner_id,'student');assert.equal(data.audit[0].previousJson,null);
 for(const table of ['finance_transactions','programme_enrolments','enrolment_audit'])assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
 }finally{h.db.close()}
});
test('rejects duplicate/rejected/unknown rows, Admin accounts, missing learners and invalid programme kinds',async()=>{
 const h=setup();try{const body=await h.ready();for(const changes of [{rowId:body.rowId.replace(':1',':2')},{rowId:body.rowId.replace(':1',':3')},{learnerId:'owner'},{learnerId:'missing'},{nodeId:'00000000-0000-4000-8000-000000000001'},{nodeId:'00000000-0000-4000-8000-000000000003'}])assert.equal((await h.review({...body,...changes})).status,400);assert.equal((await h.review({...body,rowId:'missing'})).status,404);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_reviews').get().n,0);}finally{h.db.close()}
});
test('reviewed requires both matches and evidence; pending/disputed allow incomplete matches with reason',async()=>{
 const h=setup();try{const body=await h.ready();for(const changes of [{learnerId:null},{nodeId:null},{evidenceReference:''},{reason:' '},{version:-1},{version:0.5},{evidenceNotes:[]},{evidenceReference:'x'.repeat(201)},{status:'verified'}])assert.equal((await h.review({...body,...changes})).status,400);
 assert.equal((await h.review({...body,status:'pending',learnerId:null,nodeId:null,evidenceReference:''})).status,201);assert.equal((await h.review({...body,status:'disputed',learnerId:null,nodeId:null,evidenceReference:'',version:1})).status,200);const data=await(await h.review()).json();assert.equal(data.rows[0].status,'disputed');assert.equal(data.audit.length,2);assert.equal(JSON.parse(data.audit[0].previousJson).status,'pending');
 }finally{h.db.close()}
});
test('create and update conflicts preserve the winning review and its audit; match corrections are recorded',async()=>{
 const h=setup();try{const body=await h.ready();assert.equal((await h.review(body)).status,201);assert.equal((await h.review({...body,evidenceReference:'Losing reference'})).status,409);assert.equal((await h.review({...body,version:1,status:'disputed',learnerId:null,reason:'Correct disputed learner'})).status,200);assert.equal((await h.review({...body,version:1})).status,409);const data=await(await h.review()).json();assert.equal(data.rows[0].version,2);assert.equal(data.rows[0].learnerId,null);assert.equal(data.audit.length,2);assert.equal(JSON.parse(data.audit[0].previousJson).learner_id,'student');}finally{h.db.close()}
});
test('audit insert failures roll back review inserts and updates atomically',async()=>{
 for(const existing of [false,true]){const h=setup();try{const body=await h.ready();if(existing)await h.review(body);h.db.exec("CREATE TRIGGER fail_review_audit BEFORE INSERT ON finance_review_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");assert.equal((await h.review({...body,version:existing?1:0,status:'disputed'})).status,503);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_review_audit').get().n,existing?1:0);const row=h.db.prepare('SELECT status,version FROM finance_reviews').get();assert.equal(row?.status,existing?'reviewed':undefined);assert.equal(row?.version,existing?1:undefined);}finally{h.db.close()}}
});
test('review history and identity cannot be erased; migration reapplication preserves matches and foreign keys',async()=>{
 const h=setup();try{const body=await h.ready();await h.review(body);for(const sql of ['DELETE FROM finance_reviews','DELETE FROM finance_review_audit',"UPDATE finance_review_audit SET reason='tamper'","UPDATE finance_reviews SET row_id='missing'"])assert.throws(()=>h.db.exec(sql),/Retain|append-only|immutable|accepted/);h.db.exec(readFileSync('docs/migrations/0012_finance_review.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_review_audit').get().n,1);assert.deepEqual(h.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal((await financeReviewEndpoint(h.request('GET',undefined,undefined,'/api/admin/finance-review?batchId=invalid'),owner,h.env)).status,400);}finally{h.db.close()}
});
