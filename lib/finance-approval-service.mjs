import {roleFor} from './progress-service.mjs';
import {approvalScopeSQL,captureApprovalScope,digest} from './finance-approval-scope.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const latestSnapshot=async(DB,batchId,scopeHash)=>(await DB.prepare('SELECT a.snapshot_id AS id FROM finance_approval_audit a JOIN finance_approval_snapshots s ON s.id=a.snapshot_id WHERE s.batch_id=? AND s.scope_hash=? ORDER BY a.id DESC LIMIT 1').bind(batchId,scopeHash).first())?.id;
const stateFor=(record,currentHash,latestId)=>record.scopeHash!==currentHash?'stale':record.id!==latestId?'superseded':record.decision;
async function storedSnapshotState(record,env){try{const current=await captureApprovalScope(env.DB,record.batchId,env);return current?stateFor(record,current.scopeHash,await latestSnapshot(env.DB,record.batchId,current.scopeHash)):'unavailable';}catch{return 'unavailable';}}
const summaryFields='id,batch_id AS batchId,scope_hash AS scopeHash,decision,attested,actor_id AS actorId,reason,created_at AS createdAt';
export async function financeApprovalsEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Approval review unavailable.'},503);
 try{
  if(request.method==='GET'){
   const params=new URL(request.url).searchParams,batchId=params.get('batchId'),snapshotId=params.get('snapshotId');
   if(batchId!==null&&!uuid(batchId)||snapshotId!==null&&!uuid(snapshotId))return json({error:'Invalid batch or snapshot.'},400);
   if(snapshotId){const record=await env.DB.prepare(`SELECT ${summaryFields},scope_json AS scopeJson,preview_json AS previewJson FROM finance_approval_snapshots WHERE id=?`).bind(snapshotId).first();if(!record)return json({error:'Snapshot not found.'},404);const effectiveState=await storedSnapshotState(record,env);return json({snapshot:{...record,effectiveState},canPost:false,verification:'unverified'});}
   const batch=batchId?{id:batchId}:await env.DB.prepare('SELECT id FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 1').first();
   const candidate=batch?await captureApprovalScope(env.DB,batch.id,env):null;if(batch&&!candidate)return json({error:'Import batch not found.'},404);
   const records=batch?await env.DB.prepare(`SELECT ${summaryFields} FROM finance_approval_snapshots WHERE batch_id=? ORDER BY created_at DESC,id LIMIT 20`).bind(batch.id).all():{results:[]};
   const audit=batch?await env.DB.prepare('SELECT a.snapshot_id AS snapshotId,a.actor_id AS actorId,a.reason,a.scope_hash AS scopeHash,a.decision,a.changed_at AS changedAt FROM finance_approval_audit a JOIN finance_approval_snapshots s ON s.id=a.snapshot_id WHERE s.batch_id=? ORDER BY a.id DESC LIMIT 50').bind(batch.id).all():{results:[]};
   const latestId=candidate?await latestSnapshot(env.DB,batch.id,candidate.scopeHash):null;
   return json({candidate:candidate?{scope:candidate.scope,scopeHash:candidate.scopeHash,eligibleForReviewApproval:candidate.eligibleForReviewApproval,reviewBlockers:candidate.reviewBlockers,preview:candidate.preview}:null,snapshots:(records.results||[]).map(row=>({...row,effectiveState:stateFor(row,candidate.scopeHash,latestId)})),audit:audit.results||[],reviewOnly:true,canPost:false,verification:'unverified'});
  }
  if(request.method!=='POST')return json({error:'Captured snapshots and their history are retained.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>3000)return json({error:'Approval request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!uuid(body.requestId)||!uuid(body.batchId)||!hash(body.scopeHash)||!['review_approved','held'].includes(body.decision)||typeof body.attested!=='boolean'||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300||/[\u0000-\u001f\u007f]/.test(body.reason)||body.attested!==(body.decision==='review_approved'))return json({error:'Choose the captured batch/state, review decision, explicit attestation and a change reason.'},400);
  const requestHash=await digest(JSON.stringify({batchId:body.batchId,scopeHash:body.scopeHash,decision:body.decision,attested:body.attested,reason:body.reason.trim()}));
  const prior=await env.DB.prepare(`SELECT ${summaryFields},request_hash AS requestHash FROM finance_approval_snapshots WHERE id=?`).bind(body.requestId).first();
  if(prior){if(prior.requestHash!==requestHash)return json({error:'This request ID belongs to different input. Reload before creating another snapshot.'},409);return json({id:prior.id,idempotentReplay:true,effectiveState:await storedSnapshotState(prior,env),canPost:false,verification:'unverified'});}
  const candidate=await captureApprovalScope(env.DB,body.batchId,env);if(!candidate)return json({error:'Import batch not found.'},404);
  if(candidate.scopeHash!==body.scopeHash)return json({error:'Supporting records changed. Reload the candidate before saving; unsaved fields are retained.'},409);
  if(body.decision==='review_approved'&&!candidate.eligibleForReviewApproval)return json({error:'Review approval requires complete payment rules, saved links and current manual evidence confirmations. Record a hold or resolve the issues.'},400);
  const statement=`INSERT INTO finance_approval_snapshots(id,batch_id,request_hash,scope_hash,scope_json,preview_json,decision,attested,actor_id,reason,created_at) SELECT ?4,?1,?5,?6,current.scopeJson,?7,?8,?9,?10,?11,?12 FROM (${approvalScopeSQL}) current WHERE current.scopeJson=?3 AND current.rowCount<=600 AND current.peerCount<=400 ON CONFLICT(id) DO NOTHING`;
  const result=await env.DB.prepare(statement).bind(body.batchId,env.PORTAL_ADMIN_EMAIL.toLowerCase(),candidate.scopeJson,body.requestId,requestHash,candidate.scopeHash,JSON.stringify(candidate.preview),body.decision,body.attested?1:0,user.userId,body.reason.trim(),Date.now()).run();
  if(!result.meta?.changes){const concurrent=await env.DB.prepare('SELECT request_hash AS requestHash FROM finance_approval_snapshots WHERE id=?').bind(body.requestId).first();if(concurrent?.requestHash===requestHash)return json({id:body.requestId,idempotentReplay:true,canPost:false,verification:'unverified'});return json({error:'Supporting records changed during save. Reload before capturing a new snapshot.'},409);}
  return json({id:body.requestId,idempotentReplay:false,effectiveState:body.decision,reviewOnly:true,canPost:false,verification:'unverified'},201);
 }catch(error){
  if(/Approval scope changed/.test(error.message))return json({error:'Supporting records changed during save. Reload the approval candidate.'},409);
  return json({error:'Approval review unavailable or exceeds bounded review limits. No partial snapshot is retained.'},503);
 }
}
