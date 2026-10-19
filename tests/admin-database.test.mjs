import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {socialLinksEndpoint} from '../lib/social-links-service.mjs';
import {communityEndpoint} from '../lib/community-service.mjs';

const migrations=['drizzle/0000_far_dust.sql',...['0001_social_links','0002_community_membership','0003_finance_reconciliation','0004_content_manager','0005_programme_resources'].map(n=>`docs/migrations/${n}.sql`)];
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const path of migrations)db.exec(readFileSync(path,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return {results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){const r=statement.run(...values);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}});return wrap()}};
 return {db,env:{DB,PORTAL_ADMIN_EMAIL:'owner@example.test'}};
}
const owner={userId:'owner',email:'owner@example.test'};
const request=(method='GET',body)=>new Request('https://portal.test/api/admin/test',{method,headers:{origin:'https://portal.test','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});

test('migrations preserve existing rows when reapplied and enforce relationships',()=>{
 const {db}=setup();
 try{
  db.exec("INSERT INTO community_groups(platform,title,access_tier,updated_at) VALUES('telegram','Synthetic group','free',1)");
  for(const path of migrations.slice(1))db.exec(readFileSync(path,'utf8'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM community_groups').get().n,1);
  assert.throws(()=>db.exec("INSERT INTO community_memberships(group_id,learner_id,membership_status,payment_status,updated_at) VALUES(999,'synthetic','pending','free',1)"),/FOREIGN KEY/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{db.close()}
});

test('social admin creates, reloads, updates and deletes persisted links',async()=>{
 const {db,env}=setup();const call=(method,body)=>socialLinksEndpoint(request(method,body),owner,env);
 try{
  const data={platform:'website',label:'Synthetic website',url:'https://example.test',enabled:false,sortOrder:2};
  const created=await call('POST',data);assert.equal(created.status,201);const {id}=await created.json();
  let links=(await (await call('GET')).json()).links;assert.equal(links.length,1);assert.equal(links[0].enabled,false);
  assert.equal((await call('POST',{...data,id,enabled:true})).status,200);
  links=(await (await call('GET')).json()).links;assert.equal(links[0].enabled,true);
  assert.equal((await call('POST',{...data,id:999})).status,404);
  assert.equal((await call('DELETE',{id})).status,200);
  assert.equal((await (await call('GET')).json()).links.length,0);
 }finally{db.close()}
});

test('community admin persists group state and upserts one unverified membership',async()=>{
 const {db,env}=setup();const call=body=>communityEndpoint(request(body?'POST':'GET',body),owner,env);
 try{
  const created=await call({action:'createGroup',platform:'telegram',title:'Synthetic group',programme:'English',accessTier:'premium_course'});assert.equal(created.status,201);const {id}=await created.json();
  assert.equal((await (await call()).json()).groups[0].enabled,0);
  assert.equal((await call({action:'setGroupEnabled',id,enabled:true})).status,200);
  const member={action:'upsertMembership',groupId:id,learnerId:'synthetic-student',membershipStatus:'pending',paymentStatus:'pending_verification'};
  assert.equal((await call(member)).status,200);
  assert.equal((await call({...member,membershipStatus:'confirmed'})).status,200);
  const data=await (await call()).json();assert.equal(data.groups[0].enabled,1);assert.equal(data.memberships.length,1);assert.equal(data.memberships[0].membershipStatus,'confirmed');assert.equal(data.memberships[0].verifiedAt,null);
  assert.equal((await call({...member,groupId:999})).status,404);
 }finally{db.close()}
});

test('finance schema rejects duplicate sources/references, negatives and missing tuition links',()=>{
 const {db}=setup();
 try{
  const insert=db.prepare("INSERT INTO finance_transactions(source,external_reference,transaction_kind,gross_paise,fee_paise,net_paise,paid_at,linked_tuition_id,imported_at) VALUES('appx',?,'activation',?,0,?,'2026-10-19',?,1)");
  insert.run('synthetic-1',1500,1500,null);
  assert.throws(()=>insert.run('synthetic-1',1500,1500,null),/UNIQUE/);
  assert.throws(()=>insert.run('negative',-1,-1,null),/CHECK/);
  assert.throws(()=>insert.run('orphan',1500,1500,999),/FOREIGN KEY/);
 }finally{db.close()}
});
