import {recordVersionSQL,validChange,governedWrite} from './governance-service.mjs';
import {roleFor} from './progress-service.mjs';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff'};
const PLATFORMS=new Set(['youtube','whatsapp','telegram','instagram','facebook','website']);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const error=(message,status)=>json({error:message},status);
const SOCIAL_HOSTS={youtube:['youtube.com','www.youtube.com','m.youtube.com','youtu.be'],whatsapp:['chat.whatsapp.com','whatsapp.com','www.whatsapp.com','api.whatsapp.com','wa.me'],telegram:['t.me','telegram.me'],instagram:['instagram.com','www.instagram.com'],facebook:['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','fb.watch']};
export function socialDestination(value,platform){
 try{
  if(typeof value!=='string'||value.length>500||/[\u0000-\u0020\u007f]/.test(value))return null;
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||!host||url.username||url.password||url.port||url.href.length>500||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||!host.includes('.')||host.includes('[')||/^\d+\.\d+\.\d+\.\d+$/.test(host))return null;
  if(platform!==undefined&&(!PLATFORMS.has(platform)||(platform!=='website'&&!SOCIAL_HOSTS[platform]?.includes(host))))return null;
  return url.href;
 }catch{return null;}
}
const validate=body=>{
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid social link.');
 const {platform,label,url,enabled,sortOrder}=body;
 if(!PLATFORMS.has(platform)||typeof label!=='string'||!label.trim()||label.length>70||!socialDestination(url)||typeof enabled!=='boolean'||(enabled&&!socialDestination(url,platform))||!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>9999)throw Error('Use a valid HTTPS destination and matching platform before publishing.');
 return {platform,label:label.trim(),url:socialDestination(url),enabled:enabled?1:0,sortOrder};
};
export async function socialLinksEndpoint(request,user,env){
 const admin=!!user?.userId&&roleFor(user,env)==='Admin';
 if(!admin)return error('Admin access required.',403);
 if(!env.DB)return error('Database unavailable.',503);
 try{
  if(request.method==='GET'){
   const {results=[]}=await env.DB.prepare(`SELECT r.id,r.platform,r.label,r.url,r.enabled,r.sort_order AS sortOrder,r.updated_at AS updatedAt,${recordVersionSQL('social')} AS version FROM social_links r ORDER BY r.sort_order,r.id`).all();
   return json({links:results.map(x=>({...x,enabled:!!x.enabled,publiclyVisible:!!x.enabled&&!!socialDestination(x.url,x.platform)}))});
  }
  if(request.method!=='POST'&&request.method!=='DELETE')return error('Method not allowed.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return error('Invalid request origin.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return error('JSON required.',415);
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>3000)return error('Request too large.',413);
  let body;try{body=JSON.parse(raw);}catch{return error('Invalid JSON.',400);}
  if(request.method==='DELETE'){
   if(!Number.isSafeInteger(body?.id)||body.id<1)return error('Invalid ID.',400);
   if(!validChange(body)||body.version<1)return error('Supply the current version and deletion reason.',400);
   const result=await governedWrite(env.DB,user,body.reason,env.DB.prepare(`DELETE FROM social_links AS r WHERE id=? AND ${recordVersionSQL('social')}=?`).bind(body.id,body.version));
   return result.meta?.changes?json({ok:true}):error('Link changed or was removed. Reload before deleting.',409);
  }
  let link;try{link=validate(body);}catch(e){return error(e.message,400);}
  if(!validChange(body))return error('Supply the current version (zero for a new link) and change reason.',400);
  const now=Date.now();
  if(body.id!==undefined){
   if(!Number.isSafeInteger(body.id)||body.id<1)return error('Invalid ID.',400);
   if(body.version<1)return error('Invalid link version.',400);
   const res=await governedWrite(env.DB,user,body.reason,env.DB.prepare(`UPDATE social_links AS r SET platform=?,label=?,url=?,enabled=?,sort_order=?,updated_at=? WHERE id=? AND ${recordVersionSQL('social')}=?`).bind(link.platform,link.label,link.url,link.enabled,link.sortOrder,now,body.id,body.version));
   if(!res.meta?.changes)return error('Link changed or was removed. Reload before editing.',409);
   return json({ok:true,id:body.id});
  }
  if(body.version!==0)return error('New links start at version zero.',400);
  const result=await governedWrite(env.DB,user,body.reason,env.DB.prepare('INSERT INTO social_links(platform,label,url,enabled,sort_order,updated_at) VALUES (?,?,?,?,?,?)').bind(link.platform,link.label,link.url,link.enabled,link.sortOrder,now));
  return json({ok:true,id:result.meta?.last_row_id??null},201);
 }catch{return error('Social link service unavailable.',503);}
}

export async function publicSocialLinksEndpoint(request,env){
 if(request.method!=='GET')return error('Method not allowed.',405);
 if(!env.DB)return error('Social links unavailable.',503);
 try{
  const {results=[]}=await env.DB.prepare('SELECT platform,label,url FROM social_links WHERE enabled=1 ORDER BY sort_order,id').all();
  const links=results.flatMap(row=>{const url=socialDestination(row.url,row.platform);return url&&typeof row.label==='string'&&row.label.trim()&&row.label.length<=70?[{platform:row.platform,label:row.label.trim(),url}]:[];});
  return json({links});
 }catch{return error('Social links unavailable.',503);}
}
