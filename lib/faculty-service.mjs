import {roleFor} from './progress-service.mjs';
import catalogue from './resource-catalogue.json' with {type:'json'};

const known=new Map(catalogue.map(resource=>[resource.kind+':'+resource.id,resource]));
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const scopeSQL=`WITH RECURSIVE scoped AS (
 SELECT n.id,n.kind,n.parent_id,n.title,n.description,n.status,n.sort_order
 FROM content_nodes n JOIN faculty_assignments a ON a.course_id=n.id WHERE a.faculty_id=? AND a.enabled=1
 UNION ALL SELECT n.id,n.kind,n.parent_id,n.title,n.description,n.status,n.sort_order FROM content_nodes n JOIN scoped p ON n.parent_id=p.id
)`;

export async function hasTeachingAccess(user,env){
 if(!user?.userId||!user?.email||roleFor(user,env)==='Admin'||!env.DB)return false;
 try{return !!await env.DB.prepare('SELECT id FROM faculty_assignments WHERE faculty_id=? AND enabled=1 LIMIT 1').bind(user.userId).first();}catch{return false;}
}

export async function adminFacultyEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Faculty manager unavailable.'},503);
 try{
  if(request.method==='GET'){
   const assignments=await env.DB.prepare('SELECT id,course_id AS courseId,faculty_id AS facultyId,enabled,version FROM faculty_assignments ORDER BY updated_at DESC,id').all();
   const accounts=await env.DB.prepare('SELECT user_id AS id,email,display_name AS name FROM learner_progress ORDER BY display_name,user_id').all();
   const courses=await env.DB.prepare("SELECT id,title,status FROM content_nodes WHERE kind='course' ORDER BY sort_order,title,id").all();
   const audit=await env.DB.prepare('SELECT id,assignment_id AS assignmentId,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM faculty_audit ORDER BY id DESC LIMIT 50').all();
   return json({assignments:(assignments.results||[]).map(item=>({...item,enabled:!!item.enabled})),accounts:(accounts.results||[]).filter(account=>roleFor(account,env)!=='Admin'),courses:courses.results||[],audit:audit.results||[]});
  }
  if(request.method!=='POST')return json({error:'Disable faculty assignments to retain their history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(raw.length>3000)return json({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||!uuid(body.courseId)||typeof body.facultyId!=='string'||!body.facultyId||body.facultyId.length>150||typeof body.enabled!=='boolean'||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300)return json({error:'Choose a saved account, course, enabled status and change reason.'},400);
  const account=await env.DB.prepare('SELECT email FROM learner_progress WHERE user_id=?').bind(body.facultyId).first();
  if(!account||roleFor(account,env)==='Admin')return json({error:'Choose a saved non-Admin website account.'},400);
  const course=await env.DB.prepare('SELECT kind FROM content_nodes WHERE id=?').bind(body.courseId).first();
  if(course?.kind!=='course')return json({error:'Choose an existing course.'},400);
  if(body.id!==undefined){
   if(!uuid(body.id)||!Number.isSafeInteger(body.version)||body.version<1)return json({error:'Invalid assignment or version.'},400);
   const existing=await env.DB.prepare('SELECT course_id,faculty_id FROM faculty_assignments WHERE id=?').bind(body.id).first();
   if(!existing)return json({error:'Assignment not found.'},404);
   if(existing.course_id!==body.courseId||existing.faculty_id!==body.facultyId)return json({error:'Disable this assignment and create a separate one to change its account or course.'},400);
   const result=await env.DB.prepare('UPDATE faculty_assignments SET enabled=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=?').bind(body.enabled?1:0,user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
   if(!result.meta?.changes)return json({error:'A newer version exists. Reload before editing.'},409);
   return json({id:body.id,version:body.version+1});
  }
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO faculty_assignments(id,course_id,faculty_id,enabled,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,body.courseId,body.facultyId,body.enabled?1:0,user.userId,body.reason.trim(),Date.now()).run();
  return json({id,version:1},201);
 }catch(error){
  if(/UNIQUE constraint failed/.test(error.message))return json({error:'This account already has an assignment for this course. Edit that record.'},409);
  return json({error:'Faculty manager unavailable. Existing records are retained.'},503);
 }
}

export async function facultyEndpoint(request,user,env){
 if(!user?.userId||!user?.email)return json({error:'Sign in to view teaching assignments.'},401);
 if(request.method!=='GET')return json({error:'This teaching workspace is read-only. Only Admin can change assignments or materials.'},405);
 if(roleFor(user,env)==='Admin')return json({courses:[],nodes:[],resources:[],mode:'read_only'});
 if(!env.DB)return json({error:'Teaching workspace unavailable.'},503);
 try{
  // Both scope roots and descendants are selected using only session identity.
  const nodes=await env.DB.prepare(`${scopeSQL} SELECT id,kind,parent_id AS parentId,title,description,status,sort_order AS sortOrder FROM scoped ORDER BY sort_order,title,id`).bind(user.userId).all();
  if(!nodes.results?.length)return json({courses:[],nodes:[],resources:[],mode:'read_only'});
  const links=await env.DB.prepare(`${scopeSQL} SELECT r.node_id AS nodeId,r.resource_kind AS kind,r.resource_id AS resourceId,r.enabled,r.sort_order AS sortOrder FROM programme_resources r JOIN scoped n ON n.id=r.node_id ORDER BY r.sort_order,r.id`).bind(user.userId).all();
  const now=Date.now();
  const counts=await env.DB.prepare('SELECT e.node_id AS courseId,COUNT(*) AS activeEnrolments FROM programme_enrolments e JOIN faculty_assignments a ON a.course_id=e.node_id WHERE a.faculty_id=? AND a.enabled=1 AND e.status=\'active\' AND e.starts_at<=? AND (e.ends_at IS NULL OR e.ends_at>?) GROUP BY e.node_id').bind(user.userId,now,now).all();
  // Recheck grants before returning so a revocation during this multi-query
  // read fails closed. A subsequent request always reads current grants.
  const active=await env.DB.prepare('SELECT course_id AS courseId FROM faculty_assignments WHERE faculty_id=? AND enabled=1').bind(user.userId).all();
  const allowed=new Set((active.results||[]).map(item=>item.courseId));
  const scopedNodes=nodes.results.filter(node=>node.kind==='course'?allowed.has(node.id):true);
  const retained=new Set(scopedNodes.filter(node=>node.kind==='course').map(node=>node.id));
  for(let depth=0;depth<6;depth++)for(const node of scopedNodes)if(retained.has(node.parentId))retained.add(node.id);
  const safeNodes=scopedNodes.filter(node=>retained.has(node.id));
  const courses=safeNodes.filter(node=>node.kind==='course').map(node=>({id:node.id,title:node.title,status:node.status,activeEnrolments:(counts.results||[]).find(item=>item.courseId===node.id)?.activeEnrolments||0}));
  const resources=(links.results||[]).flatMap(link=>{const resource=known.get(link.kind+':'+link.resourceId);return retained.has(link.nodeId)&&resource?[{...link,enabled:!!link.enabled,title:resource.title,href:resource.href}]:[];});
  return json({courses,nodes:safeNodes,resources,mode:'read_only'});
 }catch{return json({error:'Teaching workspace unavailable.'},503);}
}
