import {moduleGate} from './module-policy.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export const dynamicNoteId=id=>typeof id==='string'&&/^(authored|pdf)-[a-f0-9-]{36}$/.test(id);
export async function libraryEndpoint(request,env){
 if(request.method!=='GET')return json({error:'Read only.'},405);
 if(!env.DB)return json({error:'Published library unavailable.'},503);
 try{
  const paused=await moduleGate(env,'library');if(paused)return paused;
  const params=new URL(request.url).searchParams,id=params.get('id');
  if(id===null&&(params.has('limit')||params.has('cursor'))){
   const rawLimit=params.get('limit')||'50',limit=Number(rawLimit);if(!/^\d{1,3}$/.test(rawLimit)||!Number.isInteger(limit)||limit<1||limit>100)return json({error:'Choose a page size from 1 to 100.'},400);
   let cursor=null;try{if(params.has('cursor')){const raw=params.get('cursor');if(raw.length>300)throw Error();cursor=JSON.parse(atob(raw));if(!Array.isArray(cursor)||cursor.length!==2||!Number.isSafeInteger(cursor[0])||cursor[0]<0||!dynamicNoteId(cursor[1]))throw Error();}}catch{return json({error:'Invalid library page cursor.'},400);}
   const base="SELECT id,title,category,substr(body,1,160) AS description,'authored' AS source,NULL AS bytes,updated_at AS updatedAt FROM authored_materials WHERE status='published' UNION ALL SELECT id,title,category,'Free PDF study material.' AS description,'pdf' AS source,bytes,updated_at AS updatedAt FROM pdf_materials WHERE status='published'";
   const query=env.DB.prepare(`SELECT * FROM (${base}) ${cursor?'WHERE updatedAt<? OR (updatedAt=? AND id>?)':''} ORDER BY updatedAt DESC,id LIMIT ?`);
   const {results=[]}=await query.bind(...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1).all(),notes=results.slice(0,limit),last=notes.at(-1);return json({notes,nextCursor:results.length>limit?btoa(JSON.stringify([last.updatedAt,last.id])):null});
  }
if(id!==null&&!dynamicNoteId(id))return json({error:'Study material not found.'},404);
  const where=id===null?'':' AND id=?';
  let query=env.DB.prepare(`SELECT id,title,category,substr(body,1,160) AS description,'authored' AS source,NULL AS bytes,updated_at AS updatedAt FROM authored_materials WHERE status='published'${where} UNION ALL SELECT id,title,category,'Free PDF study material.' AS description,'pdf' AS source,bytes,updated_at AS updatedAt FROM pdf_materials WHERE status='published'${where} ORDER BY updatedAt DESC,id`);
  if(id!==null)query=query.bind(id,id);const {results=[]}=await query.all();
  return id===null?json({notes:results}):results.length?json({note:results[0]}):json({error:'Study material not found.'},404);
 }catch{return json({error:'Published library unavailable.'},503);}
}
// Retain withdrawn IDs already in this account's history, without granting
// content access. Omit new draft/unknown IDs uniformly, without status leaks.
export async function progressNoteSelection(DB,input,previous){
 const lists=[input?.read,input?.saved];if(lists.some(value=>value!==undefined&&(!Array.isArray(value)||value.length>1000)))return{allowed:[],omitted:[]};
 const requested=[...new Set(lists.flatMap(value=>value||[]).filter(dynamicNoteId))];if(!requested.length)return{allowed:[],omitted:[]};
 const prior=new Set([...(previous?.read||[]),...(previous?.saved||[])].filter(dynamicNoteId)),allowed=new Set(requested.filter(id=>prior.has(id))),wanted=requested.filter(id=>!prior.has(id));
 if(wanted.length){
  const encoded=JSON.stringify(wanted);
  for(const table of ['authored_materials','pdf_materials']){
   try{const {results=[]}=await DB.prepare(`SELECT id FROM ${table} WHERE status='published' AND id IN (SELECT value FROM json_each(?))`).bind(encoded).all();for(const row of results)allowed.add(row.id);}
   catch(error){if(!/no such table: (?:main\.)?(authored_materials|pdf_materials)/i.test(error.message))throw error;}
  }
 }
 return{allowed:[...allowed],omitted:requested.filter(id=>!allowed.has(id))};
}
