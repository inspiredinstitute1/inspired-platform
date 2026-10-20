import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {socialDestination,socialLinksEndpoint,publicSocialLinksEndpoint} from '../lib/social-links-service.mjs';

function setup(){
 const db=new DatabaseSync(':memory:');for(const file of ['0001_social_links','0002_community_membership','0020_social_community_audit'])db.exec(readFileSync('docs/migrations/'+file+'.sql','utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async run(){const result=statement.run(...values);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}});return wrap()},async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const env={DB,PORTAL_ADMIN_EMAIL:'owner@example.test'};
 const read=()=>publicSocialLinksEndpoint(new Request('https://local.test/api/social-links'),env);
 const write=body=>socialLinksEndpoint(new Request('https://local.test/api/admin/social-links',{method:'POST',headers:{origin:'https://local.test','content-type':'application/json'},body:JSON.stringify({version:0,reason:'Synthetic social review',...body})}),{userId:'owner',email:'owner@example.test'},env);
 return{db,env,read,write};
}

test('social destinations accept supported platform hosts without fetching external pages',()=>{
 for(const [platform,url] of [['youtube','https://youtube.com/@synthetic'],['whatsapp','https://chat.whatsapp.com/synthetic'],['telegram','https://t.me/synthetic'],['instagram','https://www.instagram.com/synthetic'],['facebook','https://www.facebook.com/synthetic'],['website','https://example.test/']])assert.equal(socialDestination(url,platform),new URL(url).href);
});

test('social destination validation rejects schemes, credentials, local/IP addresses and platform lookalikes',()=>{
 for(const url of ['javascript:alert(1)','http://youtube.com/','https://user:secret@youtube.com/','https://localhost/','https://127.0.0.1/','https://[::1]/','https://2130706433/','https://intranet/','https://host.local/','https://youtube.com:8443/','https://youtube.com/\n'])assert.equal(socialDestination(url),null,url);
 for(const url of ['https://youtube.com.evil.test/','https://evil.test/youtube.com','https://youtube.com@evil.test/'])assert.equal(socialDestination(url,'youtube'),null,url);
});

test('public social feed includes only ordered published safe fields and excludes legacy invalid rows',async()=>{
 const h=setup();try{
  const insert=h.db.prepare('INSERT INTO social_links(platform,label,url,enabled,sort_order,updated_at) VALUES(?,?,?,?,?,1)');
  insert.run('youtube','Synthetic channel','https://youtube.com/@synthetic',1,2);
  insert.run('website','Synthetic website','https://example.test/',1,1);
  insert.run('whatsapp','Private invitation','https://chat.whatsapp.com/private-synthetic',0,0);
  insert.run('youtube','Legacy wrong destination','https://evil.test/',1,0);
  insert.run('website','Legacy unsafe destination','javascript:alert(1)',1,0);
  const response=await h.read();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
  const {links}=await response.json();assert.deepEqual(links.map(link=>link.platform),['website','youtube']);
  assert(links.every(link=>Object.keys(link).sort().join(',')==='label,platform,url'));
  h.db.exec('UPDATE social_links SET enabled=0');assert.equal((await(await h.read()).json()).links.length,0);
 }finally{h.db.close()}
});

test('Admin can retain a hidden draft but cannot publish a mismatched platform destination',async()=>{
 const h=setup();try{
  const body={platform:'youtube',label:'Synthetic draft',url:'https://example.test/',enabled:false,sortOrder:1};
  assert.equal((await h.write(body)).status,201);
  assert.equal((await h.write({...body,enabled:true})).status,400);
  assert.equal((await(await h.read()).json()).links.length,0);
  assert.equal((await publicSocialLinksEndpoint(new Request('https://local.test/api/social-links',{method:'POST'}),h.env)).status,405);
 }finally{h.db.close()}
});

const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function load(globals={}){const context=vm.createContext({URL,esc:escape,...globals});vm.runInContext(readFileSync('portal/social-admin.js','utf8'),context);return context;}

test('public social markup escapes labels, excludes unsafe URLs and protects new-tab navigation',()=>{
 const context=load();const markup=context.socialPublicMarkup([{platform:'website',label:'<img src=x onerror=alert(1)>',url:'https://example.test/'},{platform:'website',label:'Unsafe',url:'javascript:alert(1)'}]);
 assert(!markup.includes('<img'));assert(!markup.includes('javascript:'));
 assert.match(markup,/&lt;img/);assert.match(markup,/rel="noopener noreferrer external"/);assert.match(markup,/referrerpolicy="no-referrer"/);
});

test('late public social response cannot restore links after a newer empty response',async()=>{
 const pending=[],target={isConnected:true,hidden:false,innerHTML:'Old links',replaceChildren(){this.innerHTML='';}};
 const context=load({document:{getElementById:()=>target},fetch:(_url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');return new Promise(resolve=>pending.push(resolve));}});
 const old=context.loadPublicSocialLinks(),current=context.loadPublicSocialLinks();
 pending[1]({ok:true,json:async()=>({links:[]})});await current;
 pending[0]({ok:true,json:async()=>({links:[{platform:'website',label:'Old',url:'https://example.test/'}]})});await old;
 assert.equal(target.hidden,true);assert.equal(target.innerHTML,'');
});
