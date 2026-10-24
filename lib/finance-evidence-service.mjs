import {roleFor} from './progress-service.mjs';
import {evidenceSnapshotSQL} from './finance-evidence-snapshot.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const bounded=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const fields='d.row_id AS rowId,d.review_version AS reviewVersion,d.snapshot_json AS snapshotJson,d.status,d.method,d.attested,d.notes,d.version,d.changed_by AS changedBy,d.change_reason AS reason,d.updated_at AS updatedAt';
export function effectiveEvidenceState(decision,reviewVersion,reviewStatus,matchEligible=true){
 if(!decision)return 'not_recorded';
 if(decision.reviewVersion!==reviewVersion)return 'stale';
 if(decision.status==='confirmed'&&(reviewStatus!=='reviewed'||!matchEligible))return 'unavailable';
 return decision.status;
}
export async function financeEvidenceEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Evidence decisions unavailable.'},503);
 try{
  if(request.method==='GET'){
   const batchId=new URL(request.url).searchParams.get('batchId');
   if(batchId!==null&&!/^[a-f0-9-]{36}$/.test(batchId))return json({error:'Invalid import batch.'},400);
   const batch=batchId?await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches WHERE id=?').bind(batchId).first():await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 1').first();
   if(batchId&&!batch)return json({error:'Import batch not found.'},404);
   const saved=batch?await env.DB.prepare(`SELECT f.id AS rowId,f.row_number AS rowNumber,f.transaction_json AS transactionJson,r.version AS currentReviewVersion,r.status AS reviewStatus,r.learner_id AS learnerId,r.node_id AS nodeId,r.evidence_reference AS evidenceReference,r.evidence_notes AS evidenceNotes,p.display_name AS learnerName,n.title AS programmeTitle,p.email AS learnerEmail,n.kind AS programmeKind,${fields.replace('d.row_id AS rowId,','')} FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN finance_evidence_decisions d ON d.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id WHERE f.batch_id=? AND f.verdict='accepted' ORDER BY f.row_number`).bind(batch.id).all():{results:[]};
   const rows=(saved.results||[]).map(row=>{const decision=row.version===null?null:{reviewVersion:row.reviewVersion,snapshotJson:row.snapshotJson,status:row.status,method:row.method,attested:!!row.attested,notes:row.notes,version:row.version,changedBy:row.changedBy,reason:row.reason,updatedAt:row.updatedAt};return{rowId:row.rowId,rowNumber:row.rowNumber,transactionJson:row.transactionJson,reviewVersion:row.currentReviewVersion||0,reviewStatus:row.reviewStatus||'pending',learnerId:row.learnerId,nodeId:row.nodeId,evidenceReference:row.evidenceReference||'',evidenceNotes:row.evidenceNotes||'',learnerName:row.learnerName||'',programmeTitle:row.programmeTitle||'',decision,effectiveState:effectiveEvidenceState(decision,row.currentReviewVersion,row.reviewStatus,!!row.learnerEmail&&roleFor({email:row.learnerEmail},env)!=='Admin'&&['course','test_series'].includes(row.programmeKind))};});
   const audit=batch?await env.DB.prepare('SELECT a.row_id AS rowId,a.actor_id AS actorId,a.reason,a.previous_json AS previousJson,a.next_json AS nextJson,a.changed_at AS changedAt FROM finance_evidence_audit a JOIN finance_import_rows f ON f.id=a.row_id WHERE f.batch_id=? ORDER BY a.id DESC LIMIT 50').bind(batch.id).all():{results:[]};
   return json({batch,rows,audit:audit.results||[],manualAttestationOnly:true,verification:'unverified',canPost:false});
  }
  if(request.method!=='POST')return json({error:'Evidence decisions and history must be retained.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>8000)return json({error:'Evidence decision too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!bounded(body.rowId,200)||!body.rowId||!Number.isSafeInteger(body.version)||body.version<0||body.version>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(body.reviewVersion)||body.reviewVersion<1||!['pending','confirmed','disputed'].includes(body.status)||!['not_checked','provider_statement','provider_dashboard','original_receipt'].includes(body.method)||typeof body.attested!=='boolean'||!bounded(body.notes,1000)||!bounded(body.reason,300)||body.reason.trim().length<3)return json({error:'Provide a saved review/version, decision, method, notes and change reason.'},400);
  if(body.status==='confirmed'?(!body.attested||body.method==='not_checked'||body.notes.trim().length<3):body.attested)return json({error:'Confirmation requires an explicit original-evidence check, method and notes. Pending/disputed decisions must not attest confirmation.'},400);
  const saved=await env.DB.prepare('SELECT r.version,r.status,r.learner_id,p.email,n.kind FROM finance_reviews r LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id WHERE r.row_id=?').bind(body.rowId).first();
  if(!saved)return json({error:'Save a review for this accepted import row first.'},400);
  if(saved.version!==body.reviewVersion)return json({error:'The payment review changed. Reload it before recording an evidence decision.'},409);
  if(body.status==='confirmed'&&(saved.status!=='reviewed'||!saved.email||roleFor({email:saved.email},env)==='Admin'||!['course','test_series'].includes(saved.kind)))return json({error:'Confirmation requires a current reviewed record with saved Student/programme matches.'},400);
  const values=[body.status,body.method,body.attested?1:0,body.notes.trim(),user.userId,body.reason.trim(),Date.now()];
  const from='FROM finance_reviews r JOIN finance_import_rows f ON f.id=r.row_id WHERE r.row_id=? AND r.version=?';
  const result=body.version===0?await env.DB.prepare(`INSERT INTO finance_evidence_decisions(row_id,review_version,snapshot_json,status,method,attested,notes,changed_by,change_reason,updated_at) SELECT r.row_id,r.version,${evidenceSnapshotSQL},?,?,?,?,?,?,? ${from} ON CONFLICT(row_id) DO NOTHING`).bind(...values,body.rowId,body.reviewVersion).run():await env.DB.prepare(`UPDATE finance_evidence_decisions SET review_version=?,snapshot_json=(SELECT ${evidenceSnapshotSQL} ${from}),status=?,method=?,attested=?,notes=?,changed_by=?,change_reason=?,updated_at=?,version=version+1 WHERE row_id=? AND version=? AND EXISTS(SELECT 1 FROM finance_reviews WHERE row_id=? AND version=?)`).bind(body.reviewVersion,body.rowId,body.reviewVersion,...values,body.rowId,body.version,body.rowId,body.reviewVersion).run();
  if(!result.meta?.changes)return json({error:'The review or evidence decision changed. Reload before saving; unsaved fields are retained.'},409);
  return json({rowId:body.rowId,version:body.version+1,reviewVersion:body.reviewVersion,manualAttestationOnly:true,verification:'unverified',canPost:false},body.version===0?201:200);
 }catch{return json({error:'Evidence decision unavailable. No partial decision change is retained.'},503);}
}
