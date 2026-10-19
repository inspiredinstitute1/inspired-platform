import {roleFor} from './progress-service.mjs';
export const MAX_PDF_BYTES=5*1024*1024;
export const MAX_PDF_REQUEST_BYTES=6*1024*1024;
const headers={'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const validId=id=>typeof id==='string'&&/^pdf-[a-f0-9-]{36}$/.test(id);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const fields='id,title,category,file_name AS fileName,bytes,status,version,updated_at AS updatedAt';
export async function pdfResourceCatalogue(DB,publishedOnly=true){
 try{
  const {results=[]}=await DB.prepare(`SELECT id,title,status FROM pdf_materials ${publishedOnly?"WHERE status='published'":''} ORDER BY title,id`).all();
  return results.map(file=>({kind:'note',id:file.id,title:'PDF · '+file.title,href:'#/pdf/'+file.id,status:file.status}));
 }catch(error){if(/no such table: (?:main\.)?pdf_materials/i.test(error.message))return[];throw error;}
}
async function uploadPdf(request,user,env){
 if(!env.BUCKET)return json({error:'PDF storage unavailable.'},503);
 if(Number(request.headers.get('content-length'))>MAX_PDF_REQUEST_BYTES)return json({error:'Upload request too large.'},413);
 // The Worker bounds the transport before parsing multipart data.
 let form;try{form=await request.formData();}catch{return json({error:'Invalid upload form.'},400);}
 const file=form.get('file'),title=form.get('title'),category=form.get('category'),reason=form.get('reason');
 if(!text(title,120)||!text(category,60)||!text(reason,300)||reason.trim().length<3)return json({error:'Add a title, category and upload reason.'},400);
 if(!(file instanceof File)||file.type!=='application/pdf'||!file.name.toLowerCase().endsWith('.pdf')||file.name.length>180||/[\x00-\x1f\x7f/\\]/.test(file.name))return json({error:'Choose a PDF file with a valid .pdf filename.'},415);
 if(file.size<32||file.size>MAX_PDF_BYTES)return json({error:'Choose a PDF from 32 bytes to 5 MiB.'},413);
 const bytes=new Uint8Array(await file.arrayBuffer()),prefix=new TextDecoder().decode(bytes.slice(0,9)),tail=new TextDecoder().decode(bytes.slice(-1024));
 if(!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n\s]/.test(prefix)||!tail.includes('%%EOF'))return json({error:'The file does not have the supported PDF header and ending.'},415);
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 const uuid=crypto.randomUUID(),id='pdf-'+uuid,key='inspired/pdfs/'+uuid+'.pdf';
 try{
  const stored=await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{sha256}});if(!stored)throw Error('Object write unavailable');
  const inserted=await env.DB.prepare('INSERT INTO pdf_materials(id,object_key,file_name,bytes,sha256,title,category,status,changed_by,change_reason,updated_at) VALUES(?,?,?,?,?,?,?,\'draft\',?,?,?)').bind(id,key,file.name,file.size,sha256,title.trim(),category.trim(),user.userId,reason.trim(),Date.now()).run();
  if(!inserted.meta?.changes)throw Error('PDF metadata was not saved');
  return json({id,version:1,status:'draft'},201);
 }catch{
  // Compensate only this newly generated private object. Metadata/audit commits
  // atomically in D1; a failed cleanup can leave an unreferenced private object.
  try{await env.BUCKET.delete(key);}catch{ /* Retain no public pointer. */ }
  return json({error:'PDF upload could not be saved. Retry with the original file.'},503);
 }
}
export async function adminFilesEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'PDF manager unavailable.'},503);
 try{
  if(request.method==='GET'){
   const files=await env.DB.prepare(`SELECT ${fields} FROM pdf_materials ORDER BY updated_at DESC,id`).all();
   const audit=await env.DB.prepare("SELECT id,file_id AS fileId,actor_id AS actorId,reason,json_extract(next_json,'$.title') AS title,json_extract(next_json,'$.status') AS status,changed_at AS changedAt FROM pdf_audit ORDER BY id DESC LIMIT 50").all();
   return json({files:files.results||[],audit:audit.results||[],maxBytes:MAX_PDF_BYTES,storageAvailable:!!env.BUCKET});
  }
  if(request.method!=='POST')return json({error:'Archive PDFs to retain the file and its history.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(request.headers.get('content-type')?.startsWith('multipart/form-data'))return await uploadPdf(request,user,env);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Upload a PDF form or send JSON metadata.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>3000)return json({error:'Request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!validId(body.id)||!Number.isSafeInteger(body.version)||body.version<1||!text(body.title,120)||!text(body.category,60)||!['draft','review','published','archived'].includes(body.status)||!text(body.reason,300)||body.reason.trim().length<3)return json({error:'Choose an existing PDF, valid title/category/status, current version and reason.'},400);
  const existing=await env.DB.prepare('SELECT object_key,bytes,sha256 FROM pdf_materials WHERE id=?').bind(body.id).first();if(!existing)return json({error:'PDF not found.'},404);
  if(body.status==='published'){
   if(!env.BUCKET)return json({error:'PDF storage unavailable.'},503);
   const object=await env.BUCKET.head(existing.object_key);if(!object||object.size!==existing.bytes||object.customMetadata?.sha256!==existing.sha256)return json({error:'Stored PDF is missing or does not match its upload record.'},409);
  }
  const saved=await env.DB.prepare('UPDATE pdf_materials SET title=?,category=?,status=?,version=version+1,changed_by=?,change_reason=?,updated_at=? WHERE id=? AND version=?').bind(body.title.trim(),body.category.trim(),body.status,user.userId,body.reason.trim(),Date.now(),body.id,body.version).run();
  if(!saved.meta?.changes)return json({error:'A newer PDF version exists. Reload before editing.'},409);
  return json({id:body.id,version:body.version+1});
 }catch{return json({error:'PDF manager unavailable. Existing files are retained.'},503);}
}
export async function filesEndpoint(request,user,env,{admin=false}={}){
 if(admin&&(!user?.userId||roleFor(user,env)!=='Admin'))return json({error:'Admin access required.'},403);
 if(request.method!=='GET')return json({error:'Read only.'},405);
 if(!env.DB)return json({error:'PDFs unavailable.'},503);
 try{
  const id=new URL(request.url).searchParams.get('id');
  if(id===null&&!admin){
   const files=await env.DB.prepare("SELECT id,title,category,bytes,updated_at AS updatedAt FROM pdf_materials WHERE status='published' ORDER BY updated_at DESC,id").all();
   return json({files:files.results||[]});
  }
  if(!validId(id))return json({error:'PDF not found.'},404);
  const record=await env.DB.prepare(`SELECT id,object_key,bytes,sha256 FROM pdf_materials WHERE id=? ${admin?'':"AND status='published'"}`).bind(id).first();if(!record)return json({error:'PDF not found.'},404);
  if(!env.BUCKET)return json({error:'PDF storage unavailable.'},503);
  const object=await env.BUCKET.get(record.object_key);
  if(!object||object.size!==record.bytes||object.customMetadata?.sha256!==record.sha256)return json({error:'Stored PDF unavailable.'},503);
  if(!admin&&!await env.DB.prepare("SELECT id FROM pdf_materials WHERE id=? AND status='published'").bind(id).first()){
   if(object.body?.cancel)void object.body.cancel().catch(()=>{});
   return json({error:'PDF not found.'},404);
  }
  return new Response(object.body,{headers:{'content-type':'application/pdf','content-length':String(record.bytes),'content-disposition':`attachment; filename="InspirED-${record.id}.pdf"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'",'referrer-policy':'no-referrer'}});
 }catch{return json({error:'PDF download unavailable.'},503);}
}
