import {roleFor} from './progress-service.mjs';
import {approvalScopeSQL,captureApprovalScope,digest} from './finance-approval-scope.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const flags={verification:'unverified',canPost:false,independentEvidenceAvailable:false,providerAdaptersConfigured:false};
const json=(body,status=200)=>new Response(JSON.stringify({...body,...flags}),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const fields='q.id,q.approval_id AS approvalId,s.batch_id AS batchId,s.scope_hash AS scopeHash,e.status,e.version,e.actor_id AS actorId,e.reason,e.changed_at AS updatedAt';
const from='FROM finance_verification_requests q JOIN finance_approval_snapshots s ON s.id=q.approval_id JOIN finance_verification_events e ON e.task_id=q.id AND e.version=(SELECT MAX(version) FROM finance_verification_events WHERE task_id=q.id)';
async function currentBinding(DB,batchId,env){
 try{const c=await captureApprovalScope(DB,batchId,env);if(!c)return null;const latest=await DB.prepare('SELECT a.snapshot_id AS id FROM finance_approval_audit a JOIN finance_approval_snapshots s ON s.id=a.snapshot_id WHERE s.batch_id=? AND s.scope_hash=? ORDER BY a.id DESC LIMIT 1').bind(batchId,c.scopeHash).first();return{scopeHash:c.scopeHash,approvalId:latest?.id};}catch{return null;}
}
async function recoverReceipt(DB,id,requestHash){const prior=await DB.prepare('SELECT task_id AS taskId,request_hash AS requestHash FROM finance_verification_events WHERE id=?').bind(id).first();return prior?.requestHash===requestHash?json({id:prior.taskId,eventId:id,idempotentReplay:true}):null;}
const bindState=(record,current)=>!current?'unavailable':record.scopeHash!==current.scopeHash?'stale':record.approvalId!==current.approvalId?'superseded':'current';
const decorate=(record,current)=>{const bindingState=bindState(record,current);return{...record,bindingState,effectiveState:record.status!=='awaiting_provider'?record.status:bindingState==='current'?'awaiting_provider':bindingState};};
export async function financeVerificationEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Verification requests unavailable.'},503);
 const DB=env.DB;let replayId,replayHash;
 try{
  if(request.method==='GET'){
   const params=new URL(request.url).searchParams,batchId=params.get('batchId'),taskId=params.get('taskId');
   if(batchId!==null&&!uuid(batchId)||taskId!==null&&!uuid(taskId))return json({error:'Invalid batch or request ID.'},400);
   if(taskId){const record=await DB.prepare(`SELECT ${fields},q.expected_json AS expectedJson ${from} WHERE q.id=?`).bind(taskId).first();if(!record)return json({error:'Verification request not found.'},404);const events=await DB.prepare('SELECT id,status,version,actor_id AS actorId,reason,changed_at AS changedAt FROM finance_verification_events WHERE task_id=? ORDER BY version DESC LIMIT 50').bind(taskId).all();return json({task:decorate(record,await currentBinding(DB,record.batchId,env)),events:events.results||[],blockers:['provider_adapters_not_configured','independent_payment_verification_required','real_ledger_posting_not_implemented']});}
   const batch=batchId?await DB.prepare('SELECT id FROM finance_import_batches WHERE id=?').bind(batchId).first():await DB.prepare('SELECT id FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 1').first();if(batchId&&!batch)return json({error:'Import batch not found.'},404);
   const current=batch?await currentBinding(DB,batch.id,env):null;
   const records=batch?await DB.prepare(`SELECT ${fields} ${from} WHERE s.batch_id=? ORDER BY q.created_at DESC,q.id LIMIT 20`).bind(batch.id).all():{results:[]};
   const approval=current?.approvalId?await DB.prepare('SELECT id,decision FROM finance_approval_snapshots WHERE id=?').bind(current.approvalId).first():null;
   const exists=approval?await DB.prepare('SELECT id FROM finance_verification_requests WHERE approval_id=?').bind(approval.id).first():null;
   return json({batch,tasks:(records.results||[]).map(record=>decorate(record,current)),requestableApprovalId:approval?.decision==='review_approved'&&!exists?approval.id:null,blockers:['provider_adapters_not_configured','independent_payment_verification_required','real_ledger_posting_not_implemented']});
  }
  if(request.method!=='POST')return json({error:'Verification requests and event history are retained.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>3000)return json({error:'Verification request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!uuid(body.requestId)||!['request','dispute','cancel'].includes(body.action)||!uuid(body.action==='request'?body.approvalId:body.taskId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300||/[\u0000-\u001f\u007f]/.test(body.reason)||body.action!=='request'&&(!Number.isSafeInteger(body.version)||body.version<1||body.version>=Number.MAX_SAFE_INTEGER))return json({error:'Choose a saved approval/request, current version, action and reason. Admin actions cannot verify payments.'},400);
  const reason=body.reason.trim(),target=body.action==='request'?body.approvalId:body.taskId,requestHash=await digest(JSON.stringify({action:body.action,target,version:body.action==='request'?null:body.version,reason}));replayId=body.requestId;replayHash=requestHash;
  const replay=await DB.prepare('SELECT task_id AS taskId,request_hash AS requestHash FROM finance_verification_events WHERE id=?').bind(body.requestId).first();
  if(replay)return replay.requestHash===requestHash?json({id:replay.taskId,eventId:body.requestId,idempotentReplay:true}):json({error:'Request ID belongs to different input.'},409);
  if(body.action==='request'){
   const snapshot=await DB.prepare('SELECT batch_id AS batchId,decision,scope_json AS scopeJson FROM finance_approval_snapshots WHERE id=?').bind(target).first();if(!snapshot)return json({error:'Approval snapshot not found.'},404);
   const candidate=await captureApprovalScope(DB,snapshot.batchId,env);
   if(!candidate||snapshot.decision!=='review_approved'||snapshot.scopeJson!==candidate.scopeJson||!candidate.eligibleForReviewApproval)return json({error:'Create a current complete review approval before requesting independent verification.'},409);
   const statement=`INSERT INTO finance_verification_requests(id,approval_id,request_hash,expected_json,actor_id,reason,created_at) SELECT ?4,s.id,?5,p.expectedJson,?6,?7,?8 FROM finance_approval_snapshots s JOIN finance_verification_expected p ON p.approvalId=s.id JOIN (${approvalScopeSQL}) current ON current.scopeJson=s.scope_json WHERE s.id=?3 AND s.decision='review_approved' AND s.id=(SELECT a.snapshot_id FROM finance_approval_audit a JOIN finance_approval_snapshots x ON x.id=a.snapshot_id WHERE x.batch_id=s.batch_id AND x.scope_hash=s.scope_hash ORDER BY a.id DESC LIMIT 1) AND current.rowCount<=600 AND current.peerCount<=400`;
   const result=await DB.prepare(statement).bind(snapshot.batchId,env.PORTAL_ADMIN_EMAIL.toLowerCase(),target,body.requestId,requestHash,user.userId,reason,Date.now()).run();if(!result.meta?.changes)return await recoverReceipt(DB,replayId,replayHash)||json({error:'Approval state changed during save. Reload before requesting verification.'},409);
   return json({id:body.requestId,eventId:body.requestId,status:'awaiting_provider',idempotentReplay:false},201);
  }
  const task=await DB.prepare(`SELECT ${fields} ${from} WHERE q.id=?`).bind(target).first();if(!task)return json({error:'Verification request not found.'},404);
  const status=body.action==='dispute'?'disputed':'cancelled';
  if(task.version!==body.version||task.status==='cancelled'||task.status==='disputed'&&status==='disputed')return await recoverReceipt(DB,replayId,replayHash)||json({error:'Request changed or is closed. Reload its event history.'},409);
  const result=await DB.prepare('INSERT INTO finance_verification_events(id,task_id,request_hash,status,version,actor_id,reason,changed_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM finance_verification_events WHERE task_id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM finance_verification_events WHERE task_id=? AND version>?)').bind(body.requestId,target,requestHash,status,body.version+1,user.userId,reason,Date.now(),target,body.version,target,body.version).run();if(!result.meta?.changes)return await recoverReceipt(DB,replayId,replayHash)||json({error:'Request changed during save. Reload its event history.'},409);
  return json({id:target,eventId:body.requestId,status,version:body.version+1,idempotentReplay:false},201);
 }catch(error){
  if(/UNIQUE/.test(error.message)&&replayId){try{const prior=await DB.prepare('SELECT task_id AS taskId,request_hash AS requestHash FROM finance_verification_events WHERE id=?').bind(replayId).first();if(prior?.requestHash===replayHash)return json({id:prior.taskId,eventId:replayId,idempotentReplay:true});}catch{/* Recover only after a confirmed matching event. */}}
  if(/UNIQUE|Verification conflict/.test(error.message))return json({error:'Verification request/approval changed or was already used. Reload history.'},409);
  return json({error:'Verification requests unavailable. No partial request or event is retained.'},503);
 }
}
