import {roleFor} from './progress-service.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const bounded=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
export async function financeReviewEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Payment reviews unavailable.'},503);
 try{
  if(request.method==='GET'){
   const batchId=new URL(request.url).searchParams.get('batchId');
   if(batchId!==null&&!uuid(batchId))return json({error:'Invalid import batch.'},400);
   const batch=batchId?await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches WHERE id=?').bind(batchId).first():await env.DB.prepare('SELECT id,source_label AS sourceLabel FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 1').first();
   if(batchId&&!batch)return json({error:'Import batch not found.'},404);
   const rows=batch?await env.DB.prepare(`SELECT f.id AS rowId,f.row_number AS rowNumber,f.transaction_json AS transactionJson,r.learner_id AS learnerId,r.node_id AS nodeId,COALESCE(r.status,'pending') AS status,COALESCE(r.evidence_reference,'') AS evidenceReference,COALESCE(r.evidence_notes,'') AS evidenceNotes,COALESCE(r.version,0) AS version FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id WHERE f.batch_id=? AND f.verdict='accepted' ORDER BY f.row_number`).bind(batch.id).all():{results:[]};
   const accounts=await env.DB.prepare('SELECT user_id AS id,email,display_name AS name FROM learner_progress ORDER BY display_name,user_id').all();
   const programmes=await env.DB.prepare("SELECT id,title,kind,status FROM content_nodes WHERE kind IN ('course','test_series') ORDER BY title,id").all();
   const audit=batch?await env.DB.prepare('SELECT a.row_id AS rowId,a.actor_id AS actorId,a.reason,a.previous_json AS previousJson,a.next_json AS nextJson,a.changed_at AS changedAt FROM finance_review_audit a JOIN finance_import_rows f ON f.id=a.row_id WHERE f.batch_id=? ORDER BY a.id DESC LIMIT 50').bind(batch.id).all():{results:[]};
   return json({batch,rows:rows.results||[],learners:(accounts.results||[]).filter(account=>roleFor(account,env)!=='Admin'),programmes:programmes.results||[],audit:audit.results||[],verification:'unverified',stagingOnly:true});
  }
  if(request.method!=='POST')return json({error:'Review history must be retained.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>8000)return json({error:'Review request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!bounded(body.rowId,200)||!body.rowId||!Number.isSafeInteger(body.version)||body.version<0||body.version>=Number.MAX_SAFE_INTEGER||!['pending','reviewed','disputed'].includes(body.status)||!(body.learnerId===null||(bounded(body.learnerId,150)&&body.learnerId.trim()))||!(body.nodeId===null||uuid(body.nodeId))||!bounded(body.evidenceReference,200)||!bounded(body.evidenceNotes,1000)||!bounded(body.reason,300)||body.reason.trim().length<3)return json({error:'Choose a review row, valid matches, status, evidence fields and change reason.'},400);
  const row=await env.DB.prepare('SELECT verdict FROM finance_import_rows WHERE id=?').bind(body.rowId).first();
  if(!row)return json({error:'Import row not found.'},404);
  if(row.verdict!=='accepted')return json({error:'Only accepted import rows can be matched. Resolve duplicate/rejected issues in the source.'},400);
  if(body.learnerId!==null){const learner=await env.DB.prepare('SELECT email FROM learner_progress WHERE user_id=?').bind(body.learnerId).first();if(!learner||roleFor(learner,env)==='Admin')return json({error:'Choose a saved website Student account.'},400);}
  if(body.nodeId!==null){const node=await env.DB.prepare('SELECT kind FROM content_nodes WHERE id=?').bind(body.nodeId).first();if(!node||!['course','test_series'].includes(node.kind))return json({error:'Choose a saved course or test series.'},400);}
  if(body.status==='reviewed'&&(!body.learnerId||!body.nodeId||body.evidenceReference.trim().length<3))return json({error:'Reviewed records require a saved learner, programme and evidence reference. This does not verify payment.'},400);
  const values=[body.learnerId,body.nodeId,body.status,body.evidenceReference.trim(),body.evidenceNotes.trim(),user.userId,body.reason.trim(),Date.now()];
  const result=body.version===0?await env.DB.prepare('INSERT INTO finance_reviews(learner_id,node_id,status,evidence_reference,evidence_notes,changed_by,change_reason,updated_at,row_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(row_id) DO NOTHING').bind(...values,body.rowId).run():await env.DB.prepare('UPDATE finance_reviews SET learner_id=?,node_id=?,status=?,evidence_reference=?,evidence_notes=?,changed_by=?,change_reason=?,updated_at=?,version=version+1 WHERE row_id=? AND version=?').bind(...values,body.rowId,body.version).run();
  if(!result.meta?.changes)return json({error:'A newer review exists. Reload this row before editing; your unsaved fields are retained.'},409);
  return json({rowId:body.rowId,version:body.version+1,verification:'unverified',stagingOnly:true},body.version===0?201:200);
 }catch{return json({error:'Payment review could not be saved or loaded. No partial review change is retained.'},503);}
}
