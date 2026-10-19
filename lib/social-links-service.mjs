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
 const admin=roleFor(user,env)==='Admin';
 if(!admin)return error('Admin access required.',403);
 if(!env.DB)return error('Database unavailable.',503);
 try{
  if(request.method==='GET'){
   const {results=[]}=await env.DB.prepare('SELECT id, platform, label, url, enabled, sort_order AS sortOrder, updated_at AS updatedAt FROM social_links ORDER BY sort_order, id').all();
   return json({links:results.map(x=>({...x,enabled:!!x.enabled,publiclyVisible:!!x.enabled&&!!socialDestination(x.url,x.platform)}))});
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

export async function publicSocialLinksEndpoint(request,env){
 if(request.method!=='GET')return error('Method not allowed.',405);
 if(!env.DB)return error('Social links unavailable.',503);
 try{
  const {results=[]}=await env.DB.prepare('SELECT platform,label,url FROM social_links WHERE enabled=1 ORDER BY sort_order,id').all();
  const links=results.flatMap(row=>{const url=socialDestination(row.url,row.platform);return url&&typeof row.label==='string'&&row.label.trim()&&row.label.length<=70?[{platform:row.platform,label:row.label.trim(),url}]:[];});
  return json({links});
 }catch{return error('Social links unavailable.',503);}
}
