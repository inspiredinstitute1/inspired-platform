import {roleFor} from './progress-service.mjs';
import {approvalScopeSQL,captureApprovalScope,digest} from './finance-approval-scope.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const flags={syntheticOnly:true,verification:'unverified',canPost:false,grantsAccess:false};
const json=(body,status=200)=>new Response(JSON.stringify({...body,...flags}),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const columns='id,kind,approval_id AS approvalId,reverses_id AS reversesId,actor_id AS actorId,reason,created_at AS createdAt';
// No published configuration enables this. This is a disposable local rehearsal,
// never an independent-verification adapter or a write to finance_transactions.
export async function financeRehearsalEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 const url=new URL(request.url);
 if(env.FINANCE_REHEARSAL_MODE!=='synthetic-local-only'||url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return json({error:'Synthetic local rehearsal is disabled.'},404);
 if(!env.DB)return json({error:'Local rehearsal database unavailable.'},503);
 const DB=env.DB;let replayId,replayHash;
 try{
  if(request.method==='GET'){
   const id=url.searchParams.get('operationId');if(id!==null&&!uuid(id))return json({error:'Invalid operation ID.'},400);
   if(id){const operation=await DB.prepare(`SELECT ${columns} FROM finance_rehearsal_operations WHERE id=?`).bind(id).first();if(!operation)return json({error:'Rehearsal operation not found.'},404);const entries=await DB.prepare('SELECT * FROM finance_rehearsal_entries WHERE operation_id=? ORDER BY id').bind(id).all();return json({operation,entries:entries.results||[]});}
   const operations=await DB.prepare(`SELECT ${columns} FROM finance_rehearsal_operations ORDER BY created_at DESC,id LIMIT 30`).all();return json({operations:operations.results||[]});
  }
  if(request.method!=='POST')return json({error:'Rehearsal history is append-only. Use a compensating reversal.'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>2000)return json({error:'Rehearsal request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!uuid(body.requestId)||!['post','reverse'].includes(body.action)||body.syntheticAcknowledgement!==true||!uuid(body.action==='post'?body.approvalId:body.operationId)||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300||/[\u0000-\u001f\u007f]/.test(body.reason))return json({error:'Choose a synthetic operation, acknowledge rehearsal-only data and supply a reason.'},400);
  const target=body.action==='post'?body.approvalId:body.operationId,reason=body.reason.trim();
  const requestHash=await digest(JSON.stringify({action:body.action,target,reason}));
  replayId=body.requestId;replayHash=requestHash;
  const prior=await DB.prepare('SELECT request_hash AS requestHash FROM finance_rehearsal_operations WHERE id=?').bind(body.requestId).first();
  if(prior)return prior.requestHash===requestHash?json({id:body.requestId,idempotentReplay:true}):json({error:'Request ID belongs to different input.'},409);
  let statement,values;
  if(body.action==='post'){
   const snapshot=await DB.prepare('SELECT batch_id AS batchId,scope_json AS scopeJson,decision FROM finance_approval_snapshots WHERE id=?').bind(target).first();
   if(!snapshot)return json({error:'Approval snapshot not found.'},404);
   const candidate=await captureApprovalScope(DB,snapshot.batchId,env);
   if(!candidate||snapshot.decision!=='review_approved'||snapshot.scopeJson!==candidate.scopeJson||!candidate.eligibleForReviewApproval)return json({error:'A current complete review approval is required for rehearsal.'},409);
   if(!candidate.scope.batch.sourceLabel.startsWith('Synthetic ')||candidate.scope.rows.some(row=>!row.transaction.externalReference.startsWith('SYNTHETIC-')))return json({error:'Rehearsal accepts explicitly named synthetic fixtures only.'},400);
   // One statement: scope and latest decision are rechecked inside the write.
   // Database triggers also enforce these conditions and create entries/audit.
   statement=`INSERT INTO finance_rehearsal_operations(id,kind,request_hash,approval_id,reverses_id,actor_id,reason,created_at) SELECT ?4,'post',?5,s.id,NULL,?6,?7,?8 FROM finance_approval_snapshots s JOIN (${approvalScopeSQL}) current ON current.scopeJson=s.scope_json WHERE s.id=?3 AND s.decision='review_approved' AND s.id=(SELECT a.snapshot_id FROM finance_approval_audit a JOIN finance_approval_snapshots x ON x.id=a.snapshot_id WHERE x.batch_id=s.batch_id AND x.scope_hash=s.scope_hash ORDER BY a.id DESC LIMIT 1) AND current.rowCount<=600 AND current.peerCount<=400`;
   values=[snapshot.batchId,env.PORTAL_ADMIN_EMAIL.toLowerCase(),target,body.requestId,requestHash,user.userId,reason,Date.now()];
  }else{
   const original=await DB.prepare("SELECT id FROM finance_rehearsal_operations WHERE id=? AND kind='post'").bind(target).first();if(!original)return json({error:'Original rehearsal post not found.'},404);
   statement="INSERT INTO finance_rehearsal_operations(id,kind,request_hash,approval_id,reverses_id,actor_id,reason,created_at) VALUES(?,'reverse',?,NULL,?,?,?,?)";
   values=[body.requestId,requestHash,target,user.userId,reason,Date.now()];
  }
  const result=await DB.prepare(statement).bind(...values).run();
  if(!result.meta?.changes)return json({error:'Approval state changed during rehearsal. Reload before retrying.'},409);
  return json({id:body.requestId,idempotentReplay:false},201);
 }catch(error){
  // A concurrent identical request can finish while this caller was validating.
  if(/UNIQUE/.test(error.message)&&replayId){try{const prior=await DB.prepare('SELECT request_hash AS requestHash FROM finance_rehearsal_operations WHERE id=?').bind(replayId).first();if(prior?.requestHash===replayHash)return json({id:replayId,idempotentReplay:true});}catch{/* Preserve a bounded failure response if recovery is unavailable. */}}
  if(/UNIQUE/.test(error.message))return json({error:'This approval, row or reversal already has a rehearsal operation. Reload history.'},409);
  if(/Rehearsal conflict/.test(error.message))return json({error:'Rehearsal conflict: approval, original posting or dependent entries changed. Reload history.'},409);
  return json({error:'Local rehearsal unavailable. No partial operation is retained.'},503);
 }
}
