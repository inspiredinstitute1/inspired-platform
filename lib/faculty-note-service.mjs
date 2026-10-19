import {roleFor} from './progress-service.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const fields='p.id,p.course_id AS courseId,p.title,p.category,p.body,p.status,p.review_note AS reviewNote,p.version';
const scope=`EXISTS(SELECT 1 FROM faculty_assignments a JOIN faculty_note_access w ON w.assignment_id=a.id WHERE a.course_id=p.course_id AND a.faculty_id=? AND a.enabled=1 AND w.enabled=1)`;
async function readBody(request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>100000)return json({error:'Request too large.'},413);
 try{const body=JSON.parse(raw);return body&&typeof body==='object'&&!Array.isArray(body)?body:json({error:'JSON object required.'},400);}catch{return json({error:'Invalid JSON.'},400);}
}
export async function facultyNotesEndpoint(request,user,env){
 if(!user?.userId||!user.email)return json({error:'Sign in to view your note proposals.'},401);
 if(roleFor(user,env)==='Admin')return json({error:'Use the Admin note review workspace.'},403);
 if(!env.DB)return json({error:'Faculty note workspace unavailable.'},503);
 try{
  if(request.method==='GET'){
   // One query joins current grants for both text and course choices. No unrelated
   // author/course/audit identity is projected or accepted from query parameters.
   const rows=await env.DB.prepare(`SELECT n.id AS courseId,n.title AS courseTitle,${fields.replace('p.course_id AS courseId,','')} FROM faculty_assignments a JOIN faculty_note_access w ON w.assignment_id=a.id JOIN content_nodes n ON n.id=a.course_id LEFT JOIN faculty_note_proposals p ON p.course_id=n.id AND p.author_id=a.faculty_id WHERE a.faculty_id=? AND a.enabled=1 AND w.enabled=1 ORDER BY n.title,p.updated_at DESC,p.id`).bind(user.userId).all();
   const courses=[...new Map((rows.results||[]).map(row=>[row.courseId,{id:row.courseId,title:row.courseTitle}])).values()];
   const proposals=(rows.results||[]).filter(row=>row.id).map(({courseTitle:_,...row})=>row);
   return json({courses,proposals});
  }
  if(request.method!=='POST')return json({error:'Save or submit a draft; history is retained.'},405);
  const body=await readBody(request);if(body instanceof Response)return body;
  if(!uuid(body.courseId)||!text(body.title,120)||!text(body.category,60)||!text(body.body,20000)||!['draft','submitted'].includes(body.status)||!text(body.reason,300)||body.reason.trim().length<3)return json({error:'Choose an assigned course, title, category, plain-text note, draft/submitted status and reason.'},400);
  if(body.id===undefined){
   if(body.status!=='draft')return json({error:'Save a draft before submitting.'},400);
   const id=crypto.randomUUID();
   const result=await env.DB.prepare(`INSERT INTO faculty_note_proposals(id,course_id,author_id,title,category,body,status,changed_by,change_reason,updated_at) SELECT ?,?,?,?,?,?,'draft',?,?,? WHERE EXISTS(SELECT 1 FROM faculty_assignments a JOIN faculty_note_access w ON w.assignment_id=a.id WHERE a.course_id=? AND a.faculty_id=? AND a.enabled=1 AND w.enabled=1)`).bind(id,body.courseId,user.userId,body.title.trim(),body.category.trim(),body.body.trim(),user.userId,body.reason.trim(),Date.now(),body.courseId,user.userId).run();
   if(!result.meta?.changes)return json({error:'Note submission access is not enabled for this course.'},403);
   return json({id,version:1},201);
  }
  if(!uuid(body.id)||!Number.isSafeInteger(body.version)||body.version<1)return json({error:'Invalid proposal or version.'},400);
  const result=await env.DB.prepare(`UPDATE faculty_note_proposals AS p SET title=?,category=?,body=?,status=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE p.id=? AND p.course_id=? AND p.author_id=? AND p.version=? AND p.status='draft' AND ${scope}`).bind(body.title.trim(),body.category.trim(),body.body.trim(),body.status,user.userId,body.reason.trim(),Date.now(),body.id,body.courseId,user.userId,body.version,user.userId).run();
  if(!result.meta?.changes)return json({error:'Proposal changed, is awaiting review, or access was removed. Reload before editing.'},409);
  return json({id:body.id,version:body.version+1});
 }catch{return json({error:'Faculty note workspace unavailable. Drafts are retained.'},503);}
}
export async function adminFacultyNotesEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Faculty review unavailable.'},503);
 try{
  if(request.method==='GET'){
   const proposals=await env.DB.prepare(`SELECT ${fields},p.author_id AS authorId,n.title AS courseTitle FROM faculty_note_proposals p JOIN content_nodes n ON n.id=p.course_id ORDER BY p.updated_at DESC,p.id`).all();
   const access=await env.DB.prepare('SELECT a.id AS assignmentId,a.enabled AS teachingEnabled,a.faculty_id AS facultyId,n.title AS courseTitle,l.display_name AS name,COALESCE(w.enabled,0) AS enabled,COALESCE(w.version,0) AS version FROM faculty_assignments a JOIN content_nodes n ON n.id=a.course_id JOIN learner_progress l ON l.user_id=a.faculty_id LEFT JOIN faculty_note_access w ON w.assignment_id=a.id ORDER BY n.title,a.faculty_id').all();
   const audit=await env.DB.prepare("SELECT id,proposal_id AS proposalId,actor_id AS actorId,reason,json_extract(next_json,'$.title') AS title,json_extract(next_json,'$.status') AS status,changed_at AS changedAt FROM faculty_note_audit ORDER BY id DESC LIMIT 50").all();
   const accessAudit=await env.DB.prepare('SELECT id,assignment_id AS assignmentId,actor_id AS actorId,reason,next_json AS nextJson,changed_at AS changedAt FROM faculty_note_access_audit ORDER BY id DESC LIMIT 50').all();
   return json({proposals:proposals.results||[],access:access.results||[],audit:audit.results||[],accessAudit:accessAudit.results||[]});
  }
  if(request.method!=='POST')return json({error:'Disable permissions or review proposals; retain their history.'},405);
  const body=await readBody(request);if(body instanceof Response)return body;
  if(!text(body.reason,300)||body.reason.trim().length<3||!Number.isSafeInteger(body.version)||body.version<0)return json({error:'A change reason and current version are required.'},400);
  if(body.action==='access'){
   if(!uuid(body.assignmentId)||typeof body.enabled!=='boolean')return json({error:'Choose an existing teaching assignment and enable/disable access.'},400);
   if(!await env.DB.prepare('SELECT id FROM faculty_assignments WHERE id=?').bind(body.assignmentId).first())return json({error:'Teaching assignment not found.'},404);
   const result=body.version===0
    ?await env.DB.prepare('INSERT OR IGNORE INTO faculty_note_access(assignment_id,enabled,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?)').bind(body.assignmentId,body.enabled?1:0,user.userId,body.reason.trim(),Date.now()).run()
    :await env.DB.prepare('UPDATE faculty_note_access SET enabled=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE assignment_id=? AND version=?').bind(body.enabled?1:0,user.userId,body.reason.trim(),Date.now(),body.assignmentId,body.version).run();
   if(!result.meta?.changes)return json({error:'A newer permission version exists. Reload before editing.'},409);
   return json({assignmentId:body.assignmentId,version:body.version+1});
  }
  if(body.action!=='review'||!uuid(body.id)||body.version<1||!['accepted','returned','rejected'].includes(body.decision))return json({error:'Choose a submitted proposal and review decision.'},400);
  const status=body.decision==='returned'?'draft':body.decision;
  const result=await env.DB.prepare("UPDATE faculty_note_proposals SET status=?,review_note=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=? AND status='submitted'").bind(status,body.reason.trim(),user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
  if(!result.meta?.changes)return json({error:'Proposal changed or is no longer submitted. Reload before reviewing.'},409);
  return json({id:body.id,version:body.version+1,...(status==='accepted'?{materialId:'authored-'+body.id}:{})});
 }catch{return json({error:'Faculty review unavailable. No partial approval is retained.'},503);}
}
