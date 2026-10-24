import {moduleSettings} from './module-policy.mjs';
import {learningResourceCatalogue} from './material-service.mjs';
import {roleFor} from './progress-service.mjs';
import {visibleProgrammesSQL} from './programme-visibility.mjs';

const headers={'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);

export async function publicProgrammeResources(DB){
 const active=new Set((await moduleSettings(DB)).modules.filter(module=>module.enabled).map(module=>module.key));
 const known=new Map((await learningResourceCatalogue(DB)).filter(resource=>active.has(({note:'library',video:'videos',test:'practice'})[resource.kind])).map(resource=>[resource.kind+':'+resource.id,resource]));
 const {results=[]}=await DB.prepare(`${visibleProgrammesSQL} SELECT r.node_id AS nodeId,r.resource_kind AS kind,r.resource_id AS resourceId,r.sort_order AS sortOrder FROM programme_resources r JOIN visible n ON n.id=r.node_id WHERE r.enabled=1 ORDER BY r.sort_order,r.id`).all();
 return results.flatMap(link=>{const resource=known.get(link.kind+':'+link.resourceId);return resource?[{...link,title:resource.title,href:resource.href}]:[];});
}

export async function resourceEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Resource manager unavailable.'},503);
 try{
  const catalogue=await learningResourceCatalogue(env.DB,{publishedOnly:false}),known=new Map(catalogue.map(resource=>[resource.kind+':'+resource.id,resource]));
  if(request.method==='GET'){
   const links=await env.DB.prepare('SELECT id,node_id AS nodeId,resource_kind AS kind,resource_id AS resourceId,enabled,sort_order AS sortOrder,version FROM programme_resources ORDER BY sort_order,id').all();
   const nodes=await env.DB.prepare('SELECT id,title,kind,status FROM content_nodes ORDER BY sort_order,title,id').all();
   const audit=await env.DB.prepare('SELECT id,link_id AS linkId,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM resource_audit ORDER BY id DESC LIMIT 50').all();
   return json({links:(links.results||[]).map(link=>({...link,enabled:!!link.enabled})),programmes:nodes.results||[],resources:catalogue,audit:audit.results||[]});
  }
  if(request.method!=='POST')return json({error:'Disable the link to retain its history and original resource.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(raw.length>3000)return json({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||!validId(body.nodeId)||!known.has(body.kind+':'+body.resourceId)||typeof body.enabled!=='boolean'||!Number.isInteger(body.sortOrder)||body.sortOrder<0||body.sortOrder>9999||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300)return json({error:'Choose an existing programme and free resource, a valid order and a change reason.'},400);
  if(!await env.DB.prepare('SELECT id FROM content_nodes WHERE id=?').bind(body.nodeId).first())return json({error:'Programme not found.'},404);
  if(body.id!==undefined){
   if(!validId(body.id)||!Number.isSafeInteger(body.version)||body.version<1)return json({error:'Invalid link or version.'},400);
   const existing=await env.DB.prepare('SELECT node_id,resource_kind,resource_id FROM programme_resources WHERE id=?').bind(body.id).first();
   if(!existing)return json({error:'Resource link not found.'},404);
   if(existing.node_id!==body.nodeId||existing.resource_kind!==body.kind||existing.resource_id!==body.resourceId)return json({error:'Disable this link and create a new one to change its programme or resource.'},400);
   const result=await env.DB.prepare('UPDATE programme_resources SET enabled=?,sort_order=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=?').bind(body.enabled?1:0,body.sortOrder,user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
   if(!result.meta?.changes)return json({error:'A newer version exists. Reload before editing.'},409);
   return json({id:body.id,version:body.version+1});
  }
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO programme_resources(id,node_id,resource_kind,resource_id,enabled,sort_order,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,body.nodeId,body.kind,body.resourceId,body.enabled?1:0,body.sortOrder,user.userId,body.reason.trim(),Date.now()).run();
  return json({id,version:1},201);
 }catch(error){
  if(/UNIQUE constraint failed/.test(error.message))return json({error:'This resource is already linked to this programme. Edit the existing link.'},409);
  return json({error:'Resource manager unavailable. Existing resources are retained.'},503);
 }
}
