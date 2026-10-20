// Test harness only. Never referenced by application build/deployment config.
import {adminFilesEndpoint,filesEndpoint} from '../../lib/file-service.mjs';
const worker={async fetch(request,env){
 const url=new URL(request.url);
 if(url.hostname!=='127.0.0.1'||request.headers.get('x-rehearsal-token')!==env.REHEARSAL_TOKEN)return new Response(null,{status:403});
 const owner={userId:'synthetic-owner',email:'owner@example.test'};
 if(url.pathname==='/admin')return adminFilesEndpoint(request,owner,env);
 if(url.pathname==='/files')return filesEndpoint(request,null,env);
 if(url.pathname==='/private')return filesEndpoint(request,owner,env,{admin:true});
 if(url.pathname==='/pause'&&request.method==='POST'){
  const {enabled}=await request.json();
  await env.DB.prepare("UPDATE portal_modules SET enabled=?,version=version+1,changed_by='synthetic-owner',change_reason='Synthetic recovery gate check',updated_at=1 WHERE module_key='library'").bind(enabled?1:0).run();
  return Response.json({ok:true});
 }
 if(url.pathname!=='/storage')return new Response(null,{status:404});
 const key=url.searchParams.get('key');
 if(!key){const page=await env.BUCKET.list({limit:2,cursor:url.searchParams.get('cursor')||undefined});return Response.json({keys:page.objects.map(o=>o.key),cursor:page.truncated?page.cursor:null});}
 if(!/^inspired\/pdfs\/[a-f0-9-]{36}\.pdf$/.test(key))return new Response(null,{status:400});
 if(request.method==='PUT'){
  const metadata=JSON.parse(request.headers.get('x-object-metadata'));
  await env.BUCKET.put(key,await request.arrayBuffer(),metadata);return new Response(null,{status:201});
 }
 if(request.method==='DELETE'){await env.BUCKET.delete(key);return new Response(null,{status:204});}
 const object=await env.BUCKET.get(key);if(!object)return new Response(null,{status:404});
 return new Response(object.body,{headers:{'x-object-metadata':JSON.stringify({httpMetadata:object.httpMetadata,customMetadata:object.customMetadata}),'content-length':String(object.size)}});
}};

export default worker;
