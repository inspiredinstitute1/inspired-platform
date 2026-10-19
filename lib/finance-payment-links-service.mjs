import {roleFor} from './progress-service.mjs';
import {paymentLinkSnapshotSQL} from './finance-payment-link-snapshot.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const id=value=>typeof value==='string'&&value.length>0&&value.length<=200;
const version=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
export async function loadPaymentLinks(DB,batchId,env){
 const saved=await DB.prepare(`SELECT f.id AS rowId,f.row_number AS rowNumber,f.transaction_json AS transactionJson,r.version AS reviewVersion,r.status AS reviewStatus,r.learner_id AS learnerId,r.node_id AS nodeId,p.email AS learnerEmail,p.display_name AS learnerName,n.kind AS programmeKind,n.title AS programmeTitle,l.target_row_id AS targetRowId,l.source_review_version AS sourceReviewVersion,l.target_review_version AS targetReviewVersion,l.snapshot_json AS snapshotJson,l.status AS linkStatus,l.version,l.changed_by AS changedBy,l.change_reason AS reason,l.updated_at AS updatedAt,t.version AS currentTargetVersion,t.status AS targetStatus,t.learner_id AS targetLearnerId,t.node_id AS targetNodeId,tp.email AS targetEmail,tn.kind AS targetProgrammeKind FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id LEFT JOIN finance_payment_links l ON l.row_id=f.id LEFT JOIN finance_reviews t ON t.row_id=l.target_row_id LEFT JOIN learner_progress tp ON tp.user_id=t.learner_id LEFT JOIN content_nodes tn ON tn.id=t.node_id WHERE f.batch_id=? AND f.verdict='accepted' ORDER BY f.row_number`).bind(batchId).all();
 return(saved.results||[]).map(row=>{
  const link=row.version===null?null:{targetRowId:row.targetRowId,sourceReviewVersion:row.sourceReviewVersion,targetReviewVersion:row.targetReviewVersion,snapshotJson:row.snapshotJson,status:row.linkStatus,version:row.version,changedBy:row.changedBy,reason:row.reason,updatedAt:row.updatedAt};
  let effectiveState='not_linked';
  if(link){effectiveState=link.status==='revoked'?'revoked':link.sourceReviewVersion!==row.reviewVersion||link.targetReviewVersion!==row.currentTargetVersion?'stale':row.reviewStatus!=='reviewed'||row.targetStatus!=='reviewed'||!row.learnerEmail||!row.targetEmail||roleFor({email:row.learnerEmail},env)==='Admin'||roleFor({email:row.targetEmail},env)==='Admin'||!['course','test_series'].includes(row.programmeKind)||!['course','test_series'].includes(row.targetProgrammeKind)||row.learnerId!==row.targetLearnerId||row.nodeId!==row.targetNodeId?'unavailable':'active';}
  return{rowId:row.rowId,rowNumber:row.rowNumber,transactionJson:row.transactionJson,reviewVersion:row.reviewVersion||0,reviewStatus:row.reviewStatus||'pending',learnerId:row.learnerId,nodeId:row.nodeId,learnerName:row.learnerName||'',programmeTitle:row.programmeTitle||'',link,effectiveState};
 });
}
export async function financePaymentLinksEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Payment links unavailable.'},503);
 try{
  if(request.method==='GET'){
   const batchId=new URL(request.url).searchParams.get('batchId');
   if(batchId!==null&&!/^[a-f0-9-]{36}$/.test(batchId))return json({error:'Invalid import batch.'},400);
   const batch=batchId?await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches WHERE id=?').bind(batchId).first():await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 1').first();
   if(batchId&&!batch)return json({error:'Import batch not found.'},404);
   const rows=batch?await loadPaymentLinks(env.DB,batch.id,env):[];
   const audit=batch?await env.DB.prepare('SELECT a.row_id AS rowId,a.actor_id AS actorId,a.reason,a.previous_json AS previousJson,a.next_json AS nextJson,a.changed_at AS changedAt FROM finance_payment_link_audit a JOIN finance_import_rows f ON f.id=a.row_id WHERE f.batch_id=? ORDER BY a.id DESC LIMIT 50').bind(batch.id).all():{results:[]};
   return json({batch,rows,audit:audit.results||[],verification:'unverified',canPost:false});
  }
  if(request.method!=='POST')return json({error:'Revoke links instead of deleting their history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>8000)return json({error:'Payment link request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!id(body.rowId)||!id(body.targetRowId)||body.rowId===body.targetRowId||!version(body.version)||!version(body.sourceReviewVersion)||body.sourceReviewVersion<1||!version(body.targetReviewVersion)||body.targetReviewVersion<1||!['active','revoked'].includes(body.status)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300||/[\u0000-\u001f\u007f]/.test(body.reason))return json({error:'Choose two saved reviews, their versions, link status and a change reason.'},400);
  const rows=await env.DB.prepare('SELECT f.id,f.batch_id,f.verdict,f.transaction_json AS transactionJson,r.version,r.status,r.learner_id AS learnerId,r.node_id AS nodeId,p.email,n.kind FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id WHERE f.id IN (?,?)').bind(body.rowId,body.targetRowId).all();
  const source=rows.results?.find(row=>row.id===body.rowId),target=rows.results?.find(row=>row.id===body.targetRowId);
  if(!source||!target||source.verdict!=='accepted'||target.verdict!=='accepted'||!source.version||!target.version||source.batch_id!==target.batch_id)return json({error:'Choose accepted rows with saved reviews in the same batch. Cross-batch matching is not supported yet.'},400);
  if(source.version!==body.sourceReviewVersion||target.version!==body.targetReviewVersion)return json({error:'A source or target review changed. Reload before saving the link.'},409);
  const existing=await env.DB.prepare('SELECT target_row_id AS targetRowId,version FROM finance_payment_links WHERE row_id=?').bind(body.rowId).first();
  if((existing?.version||0)!==body.version)return json({error:'A newer payment link exists. Reload before saving.'},409);
  if(body.status==='revoked'&&(!existing||existing.targetRowId!==body.targetRowId))return json({error:'Revoke the existing saved target; create or change a target using Active.'},400);
  if(body.status==='active'){
   const s=JSON.parse(source.transactionJson),t=JSON.parse(target.transactionJson);
   if(source.status!=='reviewed'||target.status!=='reviewed'||!source.email||!target.email||roleFor({email:source.email},env)==='Admin'||roleFor({email:target.email},env)==='Admin'||!['course','test_series'].includes(source.kind)||!['course','test_series'].includes(target.kind)||source.learnerId!==target.learnerId||source.nodeId!==target.nodeId||s.paidAt<t.paidAt||!(s.transactionKind==='activation'?s.source==='appx'&&t.source!=='appx'&&t.transactionKind==='tuition':s.transactionKind==='refund'&&s.feePaise===0&&['tuition','mock_test'].includes(t.transactionKind)))return json({error:'Link requires reviewed matching Student/programme records, valid payment kinds, sources and dates. Refund fees need a separate policy.'},400);
  }
  const from='FROM finance_reviews s JOIN finance_import_rows sf ON sf.id=s.row_id JOIN finance_reviews t ON t.row_id=? JOIN finance_import_rows tf ON tf.id=t.row_id WHERE s.row_id=? AND s.version=? AND t.version=?';
  const pair=[body.targetRowId,body.rowId,body.sourceReviewVersion,body.targetReviewVersion],values=[body.status,user.userId,body.reason.trim(),Date.now()];
  const result=body.version===0?await env.DB.prepare(`INSERT INTO finance_payment_links(row_id,target_row_id,source_review_version,target_review_version,snapshot_json,status,changed_by,change_reason,updated_at) SELECT s.row_id,t.row_id,s.version,t.version,${paymentLinkSnapshotSQL},?,?,?,? ${from} ON CONFLICT(row_id) DO NOTHING`).bind(...values,...pair).run():await env.DB.prepare(`UPDATE finance_payment_links SET target_row_id=?,source_review_version=?,target_review_version=?,snapshot_json=(SELECT ${paymentLinkSnapshotSQL} ${from}),status=?,changed_by=?,change_reason=?,updated_at=?,version=version+1 WHERE row_id=? AND version=? AND EXISTS(SELECT 1 FROM finance_reviews WHERE row_id=? AND version=?) AND EXISTS(SELECT 1 FROM finance_reviews WHERE row_id=? AND version=?)`).bind(body.targetRowId,body.sourceReviewVersion,body.targetReviewVersion,...pair,...values,body.rowId,body.version,body.rowId,body.sourceReviewVersion,body.targetRowId,body.targetReviewVersion).run();
  if(!result.meta?.changes)return json({error:'The payment link or one of its reviews changed. Reload; unsaved fields are retained.'},409);
  return json({rowId:body.rowId,version:body.version+1,verification:'unverified',canPost:false},body.version===0?201:200);
 }catch(error){
  if(/Payment link conflict|Payment link snapshot/.test(error.message))return json({error:'Payment link conflict: another activation, excessive refunds or a changed relationship requires review. Reload before saving.'},409);
  return json({error:'Payment link unavailable. No partial link change is retained.'},503);
 }
}
