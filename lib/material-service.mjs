import {pdfResourceCatalogue} from './file-service.mjs';
import {roleFor} from './progress-service.mjs';
import catalogue from './resource-catalogue.json' with {type:'json'};
const headers={'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const validId=id=>typeof id==='string'&&/^authored-[a-f0-9-]{36}$/.test(id);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const fields='id,title,category,body,status,version,updated_at AS updatedAt';

// Static catalogue remains available if migration 0008 has not yet been applied.
// Only a missing table is tolerated; other database errors fail closed.
export async function learningResourceCatalogue(DB,{publishedOnly=true}={}){
 let results=[];
 try{({results=[]}=await DB.prepare(`SELECT id,title,status FROM authored_materials ${publishedOnly?"WHERE status='published'":''} ORDER BY title,id`).all());}
 catch(error){if(!/no such table: (?:main\.)?authored_materials/i.test(error.message))throw error;}
 return [...catalogue,...results.map(note=>({kind:'note',id:note.id,title:note.title,href:'#/material/'+note.id,status:note.status})),...await pdfResourceCatalogue(DB,publishedOnly)];
}

export async function materialEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Study note manager unavailable.'},503);
 try{
  if(request.method==='GET'){
   const notes=await env.DB.prepare(`SELECT ${fields} FROM authored_materials ORDER BY updated_at DESC,id`).all();
   // Full immutable snapshots stay in the database; list responses omit bodies.
   const audit=await env.DB.prepare("SELECT id,material_id AS materialId,actor_id AS actorId,reason,json_extract(next_json,'$.title') AS title,json_extract(next_json,'$.status') AS status,changed_at AS changedAt FROM material_audit ORDER BY id DESC LIMIT 50").all();
   return json({notes:notes.results||[],audit:audit.results||[]});
  }
  if(request.method!=='POST')return json({error:'Archive notes to retain their history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>100000)return json({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!text(body.title,120)||!text(body.category,60)||!text(body.body,20000)||!['draft','review','published','archived'].includes(body.status)||!text(body.reason,300)||body.reason.trim().length<3)return json({error:'Add a title, category, plain-text note, valid status and change reason.'},400);
  if(body.id===undefined&&body.status!=='draft')return json({error:'Create a draft first, then review and explicitly publish it.'},400);
  if(body.id!==undefined){
   if(!validId(body.id)||!Number.isSafeInteger(body.version)||body.version<1)return json({error:'Invalid note or version.'},400);
   const existing=await env.DB.prepare('SELECT id FROM authored_materials WHERE id=?').bind(body.id).first();
   if(!existing)return json({error:'Study note not found.'},404);
   const saved=await env.DB.prepare('UPDATE authored_materials SET title=?,category=?,body=?,status=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=?').bind(body.title.trim(),body.category.trim(),body.body.trim(),body.status,user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
   if(!saved.meta?.changes)return json({error:'A newer version exists. Reload before editing.'},409);
   return json({id:body.id,version:body.version+1});
  }
  const id='authored-'+crypto.randomUUID();
  await env.DB.prepare('INSERT INTO authored_materials(id,title,category,body,status,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,body.title.trim(),body.category.trim(),body.body.trim(),'draft',user.userId,body.reason.trim(),Date.now()).run();
  return json({id,version:1},201);
 }catch{return json({error:'Study note manager unavailable. Existing notes are retained.'},503);}
}

export async function publicMaterialsEndpoint(request,env){
 if(request.method!=='GET')return json({error:'Read only.'},405);
 if(!env.DB)return json({error:'Study notes unavailable.'},503);
 try{
  const id=new URL(request.url).searchParams.get('id');
  if(id!==null){
   if(!validId(id))return json({error:'Study note not found.'},404);
   const note=await env.DB.prepare("SELECT id,title,category,body,updated_at AS updatedAt FROM authored_materials WHERE id=? AND status='published'").bind(id).first();
   return note?json({note}):json({error:'Study note not found.'},404);
  }
  const notes=await env.DB.prepare("SELECT id,title,category,updated_at AS updatedAt FROM authored_materials WHERE status='published' ORDER BY updated_at DESC,id").all();
  return json({notes:notes.results||[]});
 }catch{return json({error:'Study notes unavailable.'},503);}
}
