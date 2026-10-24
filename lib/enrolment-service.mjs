import {moduleGate} from './module-policy.mjs';
import {roleFor} from './progress-service.mjs';
import {visibleProgrammesSQL} from './programme-visibility.mjs';
import {publicProgrammeResources} from './resource-service.mjs';

const statuses=['pending','active','paused','revoked','expired'];
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const time=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
const fields='id,node_id AS nodeId,learner_id AS learnerId,status,starts_at AS startsAt,ends_at AS endsAt,version';
export function effectiveEnrolmentStatus(record,now=Date.now()){
 if(record.status!=='active')return record.status;
 if(record.endsAt!==null&&record.endsAt<=now)return 'expired';
 return record.startsAt>now?'scheduled':'active';
}

export async function adminEnrolmentEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Enrolment manager unavailable.'},503);
 try{
  if(request.method==='GET'){
   const records=await env.DB.prepare(`SELECT ${fields} FROM programme_enrolments ORDER BY updated_at DESC,id`).all();
   const accounts=await env.DB.prepare('SELECT user_id AS id,email,display_name AS name FROM learner_progress ORDER BY display_name,user_id').all();
   const programmes=await env.DB.prepare("SELECT id,title,kind,status FROM content_nodes WHERE kind IN ('course','test_series') ORDER BY sort_order,title,id").all();
   const audit=await env.DB.prepare('SELECT id,enrolment_id AS enrolmentId,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM enrolment_audit ORDER BY id DESC LIMIT 50').all();
   return json({enrolments:(records.results||[]).map(record=>({...record,effectiveStatus:effectiveEnrolmentStatus(record)})),learners:(accounts.results||[]).filter(account=>roleFor(account,env)!=='Admin'),programmes:programmes.results||[],audit:audit.results||[]});
  }
  if(request.method!=='POST')return json({error:'Revoke enrolments to retain their history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(raw.length>3000)return json({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||!uuid(body.nodeId)||typeof body.learnerId!=='string'||!body.learnerId||body.learnerId.length>150||!statuses.includes(body.status)||!time(body.startsAt)||(body.endsAt!==null&&(!time(body.endsAt)||body.endsAt<=body.startsAt))||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300)return json({error:'Choose an existing student/course, valid dates, status and a change reason.'},400);
  const learner=await env.DB.prepare('SELECT email FROM learner_progress WHERE user_id=?').bind(body.learnerId).first();
  if(!learner||roleFor(learner,env)==='Admin')return json({error:'Choose a saved website Student account.'},400);
  const node=await env.DB.prepare('SELECT kind FROM content_nodes WHERE id=?').bind(body.nodeId).first();
  if(!node||!['course','test_series'].includes(node.kind))return json({error:'Choose an existing course or test series.'},400);
  if(body.id!==undefined){
   if(!uuid(body.id)||!Number.isSafeInteger(body.version)||body.version<1)return json({error:'Invalid enrolment or version.'},400);
   const existing=await env.DB.prepare('SELECT node_id,learner_id FROM programme_enrolments WHERE id=?').bind(body.id).first();
   if(!existing)return json({error:'Enrolment not found.'},404);
   if(existing.node_id!==body.nodeId||existing.learner_id!==body.learnerId)return json({error:'Revoke this record and create a separate enrolment to change its student or course.'},400);
   const result=await env.DB.prepare('UPDATE programme_enrolments SET status=?,starts_at=?,ends_at=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=?').bind(body.status,body.startsAt,body.endsAt,user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
   if(!result.meta?.changes)return json({error:'A newer version exists. Reload before editing.'},409);
   return json({id:body.id,version:body.version+1});
  }
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO programme_enrolments(id,node_id,learner_id,status,starts_at,ends_at,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,body.nodeId,body.learnerId,body.status,body.startsAt,body.endsAt,user.userId,body.reason.trim(),Date.now()).run();
  return json({id,version:1},201);
 }catch(error){
  if(/UNIQUE constraint failed/.test(error.message))return json({error:'This student already has an enrolment for this programme. Edit that record.'},409);
  return json({error:'Enrolment manager unavailable. Existing records are retained.'},503);
 }
}

export async function myEnrolmentsEndpoint(request,user,env){
 if(!user?.userId||!user?.email)return json({error:'Sign in to view your programmes.'},401);
 if(request.method!=='GET')return json({error:'Only Admin can change enrolments.'},405);
 if(!env.DB)return json({error:'Your programmes are temporarily unavailable.'},503);
 try{
  const paused=await moduleGate(env,'programmes');if(paused)return paused;
  // Learner identity comes only from the trusted session, never query/body IDs.
  const {results=[]}=await env.DB.prepare(`SELECT ${fields} FROM programme_enrolments WHERE learner_id=? ORDER BY updated_at DESC,id`).bind(user.userId).all();
  if(!results.length)return json({enrolments:[]});
  const {results:visible=[]}=await env.DB.prepare(`${visibleProgrammesSQL} SELECT id,parent_id AS parentId,title FROM visible`).all();
  const resources=await publicProgrammeResources(env.DB);
  const enrolments=results.map(record=>{
   const programme=visible.find(node=>node.id===record.nodeId),effectiveStatus=effectiveEnrolmentStatus(record),available=!!programme&&effectiveStatus==='active';
   const descendants=new Set([record.nodeId]);
   for(let depth=0;depth<6;depth++)for(const node of visible)if(descendants.has(node.parentId))descendants.add(node.id);
   return{id:record.id,nodeId:record.nodeId,title:programme?.title||'Programme temporarily unavailable',effectiveStatus,startsAt:record.startsAt,endsAt:record.endsAt,available,resources:available?resources.filter(resource=>descendants.has(resource.nodeId)):[]};
  });
  return json({enrolments});
 }catch{return json({error:'Your programmes are temporarily unavailable.'},503);}
}
