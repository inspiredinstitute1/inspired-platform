import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {financeImportsEndpoint} from '../../lib/finance-import-service.mjs';
import {financeReviewEndpoint} from '../../lib/finance-review-service.mjs';
import {financeEvidenceEndpoint} from '../../lib/finance-evidence-service.mjs';
import {financePaymentLinksEndpoint} from '../../lib/finance-payment-links-service.mjs';
import {financeApprovalsEndpoint} from '../../lib/finance-approval-service.mjs';
import {financeRehearsalEndpoint} from '../../lib/finance-rehearsal-service.mjs';
export const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'};
export function setupRehearsal(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 const migrations=['drizzle/0000_far_dust.sql',...['0003_finance_reconciliation','0004_content_manager','0006_programme_enrolments','0011_finance_import_staging','0012_finance_review','0013_finance_evidence_decisions','0014_finance_payment_links','0015_cross_batch_payment_links','0016_finance_approval_snapshots','0017_finance_rehearsal_journal'].map(name=>'docs/migrations/'+name+'.sql')];
 for(const path of migrations)db.exec(readFileSync(path,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email,FINANCE_REHEARSAL_MODE:'synthetic-local-only'};
 db.exec("INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES('student','student@example.test','Synthetic learner','Student','{}',1,1); INSERT INTO content_nodes(id,kind,parent_id,title,changed_by,change_reason,updated_at) VALUES('00000000-0000-4000-8000-000000000001','division',NULL,'Synthetic division','owner','Synthetic setup',1),('00000000-0000-4000-8000-000000000002','course','00000000-0000-4000-8000-000000000001','Synthetic course','owner','Synthetic setup',1);");
 const request=(method,body,url='http://127.0.0.1/api/admin/finance-rehearsal',origin=new URL(url).origin)=>new Request(url,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',url,origin)=>financeRehearsalEndpoint(request(method,body,url,origin),user,env);
 const review=rowId=>({rowId,version:0,learnerId:'student',nodeId:'00000000-0000-4000-8000-000000000002',status:'reviewed',evidenceReference:'Synthetic original receipt',evidenceNotes:'Synthetic fixture',reason:'Synthetic review'});
 const link=body=>financePaymentLinksEndpoint(request('POST',body),owner,env);
 const row={source:'phonepe',externalReference:'SYNTHETIC-'+crypto.randomUUID(),transactionKind:'tuition',grossPaise:10000,feePaise:0,netPaise:10000,paidAt:'2026-10-19'};
 const batch=async(rows=[row],label='Synthetic journal export')=>{
  const result=await financeImportsEndpoint(request('POST',{requestId:crypto.randomUUID(),sourceLabel:label,reason:'Synthetic journal fixture',format:'json',data:JSON.stringify(rows)}),owner,env);assert.equal(result.status,201,await result.clone().text());const {batchId}=await result.json();const ids=rows.map((_,index)=>batchId+':'+(index+1));
  for(const rowId of ids){assert.equal((await financeReviewEndpoint(request('POST',review(rowId)),owner,env)).status,201);assert.equal((await financeEvidenceEndpoint(request('POST',{rowId,reviewVersion:1,version:0,status:'confirmed',method:'original_receipt',attested:true,notes:'Synthetic receipt check',reason:'Synthetic confirmation'}),owner,env)).status,201);}
  return{batchId,ids};
 };
 const approval=async(batchId,decision='review_approved')=>{
  const candidate=await(await financeApprovalsEndpoint(request('GET',undefined,'http://127.0.0.1/api/admin/finance-approvals?batchId='+batchId),owner,env)).json();
  const input={requestId:crypto.randomUUID(),batchId,scopeHash:candidate.candidate.scopeHash,decision,attested:decision==='review_approved',reason:'Synthetic approval decision'};const result=await financeApprovalsEndpoint(request('POST',input),owner,env);assert.equal(result.status,201,await result.clone().text());return input.requestId;
 };
 const postBody=approvalId=>({requestId:crypto.randomUUID(),action:'post',approvalId,syntheticAcknowledgement:true,reason:'Synthetic journal posting'});
 const reverseBody=operationId=>({requestId:crypto.randomUUID(),action:'reverse',operationId,syntheticAcknowledgement:true,reason:'Synthetic journal compensation'});
 const linkBody=(rowId,targetRowId,changes={})=>({rowId,targetRowId,sourceReviewVersion:1,targetReviewVersion:1,version:0,status:'active',reason:'Synthetic original mapping',...changes});
 const totals=()=>db.prepare('SELECT SUM(tuition_paise) AS tuition,SUM(mock_paise) AS mock,SUM(activation_paise) AS activation,SUM(fee_paise) AS fee,SUM(refund_paise) AS refund,SUM(cash_paise) AS cash FROM finance_rehearsal_entries').get();
 return{db,DB,env,migrations,request,call,batch,approval,postBody,reverseBody,row,link,linkBody,review,totals};
}
