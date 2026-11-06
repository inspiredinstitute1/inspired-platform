import {roleFor} from './progress-service.mjs';
import {MODULES,moduleSettings} from './module-policy.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export async function publicModulesEndpoint(request,env){
 if(request.method!=='GET')return json({error:'Read only.'},405);
 try{const settings=await moduleSettings(env.DB);return json({modules:settings.modules.map(({key,enabled,showNavigation})=>({key,enabled,showNavigation}))});}catch{return json({error:'Learning availability unavailable.'},503);}
}
export async function modulesEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Module manager unavailable.'},503);
 try{
  if(request.method==='GET'){const settings=await moduleSettings(env.DB);const audit=settings.persisted?await env.DB.prepare('SELECT module_key AS key,actor_id AS actorId,reason,previous_json AS previousJson,next_json AS nextJson,changed_at AS changedAt FROM portal_module_audit ORDER BY id DESC LIMIT 50').all():{results:[]};return json({...settings,audit:audit.results||[]});}
  if(request.method!=='POST')return json({error:'Disable a section to retain its data and history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>2000)return json({error:'Module request too large.'},413);let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!MODULES.some(module=>module.key===body.key)||typeof body.enabled!=='boolean'||typeof body.showNavigation!=='boolean'||!Number.isSafeInteger(body.version)||body.version<1||body.version>=Number.MAX_SAFE_INTEGER||typeof body.reason!=='string'||body.reason.trim().length<3||body.reason.length>300||/[\u0000-\u001f\u007f]/.test(body.reason))return json({error:'Choose an existing section, availability/navigation settings, current version and reason.'},400);
  const saved=await env.DB.prepare('UPDATE portal_modules SET enabled=?,show_navigation=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE module_key=? AND version=?').bind(body.enabled?1:0,body.showNavigation?1:0,user.userId,body.reason.trim(),Date.now(),body.key,body.version).run();
  if(!saved.meta?.changes)return json({error:'Module settings changed. Reload before saving; unsaved choices are retained.'},409);
  return json({key:body.key,version:body.version+1});
 }catch{return json({error:'Module manager unavailable. No partial settings/audit change is retained.'},503);}
}
