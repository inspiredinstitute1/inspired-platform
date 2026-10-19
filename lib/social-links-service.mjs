import {roleFor} from './progress-service.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'};
const PLATFORMS=new Set(['youtube','whatsapp','telegram','instagram','facebook','website']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const error=(message,status)=>json({error:message},status);
const isUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password&&u.href.length<=500;}catch{return false;}};
const validate=body=>{
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid social link.');
 const {platform,label,url,enabled,sortOrder}=body;
 if(!PLATFORMS.has(platform)||typeof label!=='string'||!label.trim()||label.length>70||!isUrl(url)||typeof enabled!=='boolean'||!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>9999)throw Error('Invalid social link fields.');
 return {platform,label:label.trim(),url,enabled:enabled?1:0,sortOrder};
};
export async function socialLinksEndpoint(request,user,env){
 const admin=roleFor(user,env)==='Admin';
 if(!admin)return error('Admin access required.',403);
 if(!env.DB)return error('Database unavailable.',503);
 try{
  if(request.method==='GET'){
   const {results=[]}=await env.DB.prepare('SELECT id, platform, label, url, enabled, sort_order AS sortOrder, updated_at AS updatedAt FROM social_links ORDER BY sort_order, id').all();
   return json({links:results.map(x=>({...x,enabled:!!x.enabled}))});
  }
  if(request.method!=='POST'&&request.method!=='DELETE')return error('Method not allowed.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return error('Invalid request origin.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return error('JSON required.',415);
  const raw=await request.text();
  if(raw.length>3000)return error('Request too large.',413);
  let body;try{body=JSON.parse(raw);}catch{return error('Invalid JSON.',400);}
  if(request.method==='DELETE'){
   if(!Number.isSafeInteger(body?.id)||body.id<1)return error('Invalid ID.',400);
   await env.DB.prepare('DELETE FROM social_links WHERE id=?').bind(body.id).run();
   return json({ok:true});
  }
  let link;try{link=validate(body);}catch(e){return error(e.message,400);}
  const now=Date.now();
  if(body.id!==undefined){
   if(!Number.isSafeInteger(body.id)||body.id<1)return error('Invalid ID.',400);
   const res=await env.DB.prepare('UPDATE social_links SET platform=?, label=?, url=?, enabled=?, sort_order=?, updated_at=? WHERE id=?').bind(link.platform,link.label,link.url,link.enabled,link.sortOrder,now,body.id).run();
   if(!res.meta?.changes)return error('Link not found.',404);
   return json({ok:true,id:body.id});
  }
  const result=await env.DB.prepare('INSERT INTO social_links(platform,label,url,enabled,sort_order,updated_at) VALUES (?,?,?,?,?,?)').bind(link.platform,link.label,link.url,link.enabled,link.sortOrder,now).run();
  return json({ok:true,id:result.meta?.last_row_id??null},201);
 }catch{return error('Social link service unavailable.',503);}
}
