import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminEnrolmentEndpoint,myEnrolmentsEndpoint,effectiveEnrolmentStatus} from '../lib/enrolment-service.mjs';
import {contentEndpoint} from '../lib/content-service.mjs';
import {resourceEndpoint} from '../lib/resource-service.mjs';
import catalogue from '../lib/resource-catalogue.json' with {type:'json'};
import {emptyProgress} from '../lib/progress-service.mjs';

const owner={userId:'owner',email:'owner@example.test'},student={userId:'student-a',email:'a@example.test'},other={userId:'student-b',email:'b@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql',...['0004_content_manager','0005_programme_resources','0006_programme_enrolments'].map(name=>`docs/migrations/${name}.sql`)])db.exec(readFileSync(file,'utf8'));
 for(const user of [owner,student,other])db.prepare('INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES(?,?,?,?,?,1,1)').run(user.userId,user.email,user.userId,user===owner?'Admin':'Student',JSON.stringify(emptyProgress()));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){const result=statement.run(...values);return{meta:{changes:Number(result.changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test',url='https://local.test/api/admin/enrolments')=>new Request(url,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>adminEnrolmentEndpoint(request(method,body,origin),user,env);
 const mine=(user=student,url='https://local.test/api/enrolments')=>myEnrolmentsEndpoint(request('GET',undefined,undefined,url),user,env);
 async function createNode(kind,parentId=null){const body={kind,parentId,title:'Synthetic '+kind,description:'',status:'published',sortOrder:1,reason:'Create test programme'};const response=await contentEndpoint(request('POST',body),owner,env);assert.equal(response.status,201);return{...body,...await response.json()};}
 async function createCourse(){const division=await createNode('division');const course=await createNode('course',division.id);return{division,course};}
 const enrolment=node=>({nodeId:node.id,learnerId:student.userId,status:'pending',startsAt:0,endsAt:null,reason:'Manual website enrolment'});
 async function create(body){const response=await call(body);assert.equal(response.status,201,await response.clone().text());return{...body,...await response.json()};}
 return{db,env,request,call,mine,createNode,createCourse,enrolment,create};
}

test('enrolment timing handles scheduled starts, exact expiry boundaries and explicit revocation',()=>{
 const active={status:'active',startsAt:0,endsAt:null};
 assert.equal(effectiveEnrolmentStatus(active,100),'active');
 assert.equal(effectiveEnrolmentStatus({...active,startsAt:101},100),'scheduled');
 assert.equal(effectiveEnrolmentStatus({...active,endsAt:100},100),'expired');
 for(const status of ['pending','paused','revoked','expired'])assert.equal(effectiveEnrolmentStatus({...active,status,endsAt:1},100),status);
});

test('students cannot change enrolments or read the Admin roster; unsigned reads fail',async()=>{
 const h=setup();try{
  for(const user of [null,student])for(const body of [undefined,{}])assert.equal((await h.call(body,user)).status,403);
  assert.equal((await h.mine(null)).status,401);
  assert.equal((await myEnrolmentsEndpoint(h.request('POST',{}),student,h.env)).status,405);
  assert.equal((await h.call({},owner,'POST','https://other.test')).status,403);
  assert.equal((await h.call({},owner,'DELETE')).status,405);
 }finally{h.db.close()}
});

test('enrolment validates saved Student identity, course scope, dates and reasons',async()=>{
 const h=setup();try{
  const {division,course}=await h.createCourse(),base=h.enrolment(course);
  for(const changes of [{learnerId:'unknown'},{learnerId:owner.userId},{nodeId:division.id},{nodeId:crypto.randomUUID()},{endsAt:0},{endsAt:1,startsAt:2},{startsAt:-1},{status:'paid_verified'},{reason:''}])assert.equal((await h.call({...base,...changes})).status,400);
  const data=await(await h.call()).json();assert.equal(data.learners.length,2);assert(data.learners.every(item=>item.id!==owner.userId));
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_enrolments').get().n,0);
 }finally{h.db.close()}
});

test('My programmes is scoped to the trusted identity and excludes private roster/audit fields',async()=>{
 const h=setup();try{
  const {course}=await h.createCourse();await h.create({...h.enrolment(course),status:'active'});
  const data=await(await h.mine(student,'https://local.test/api/enrolments?learnerId=student-b')).json();assert.equal(data.enrolments.length,1);
  const entry=data.enrolments[0];assert.equal(entry.title,course.title);assert.equal(entry.available,true);
  for(const field of ['learnerId','email','reason','actorId','version','audit'])assert(!(field in entry));
  assert.equal((await(await h.mine(other,'https://local.test/api/enrolments?learnerId=student-a')).json()).enrolments.length,0);
 }finally{h.db.close()}
});

test('active enrolments show descendant free links; expiry/revocation and hidden ancestors suppress the enrolled view',async()=>{
 const h=setup();try{
  const {division,course}=await h.createCourse(),subject=await h.createNode('subject',course.id),unit=await h.createNode('module',subject.id);
  const note=catalogue.find(item=>item.kind==='note');
  const link={nodeId:unit.id,kind:'note',resourceId:note.id,enabled:true,sortOrder:1,reason:'Attach existing free material'};
  assert.equal((await resourceEndpoint(h.request('POST',link),owner,h.env)).status,201);
  const enrolled=await h.create({...h.enrolment(course),status:'active'});
  let entry=(await(await h.mine()).json()).enrolments[0];assert.equal(entry.resources.length,1);assert.equal(entry.resources[0].href,note.href);
  assert.equal((await h.call({...enrolled,endsAt:1})).status,200);
  entry=(await(await h.mine()).json()).enrolments[0];assert.equal(entry.effectiveStatus,'expired');assert.equal(entry.resources.length,0);
  assert.equal((await h.call({...enrolled,version:2,status:'revoked'})).status,200);
  assert.equal((await(await h.mine()).json()).enrolments[0].available,false);
  assert.equal((await h.call({...enrolled,version:3,status:'active'})).status,200);
  assert.equal((await contentEndpoint(h.request('POST',{...division,status:'paused'}),owner,h.env)).status,200);
  entry=(await(await h.mine()).json()).enrolments[0];assert.equal(entry.available,false);assert.equal(entry.resources.length,0);assert.equal(entry.title,'Programme temporarily unavailable');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_enrolments').get().n,1);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_resources').get().n,1);
 }finally{h.db.close()}
});

test('enrolment edits reject duplicates, stale versions and identity changes and audit the trusted actor',async()=>{
 const h=setup();try{
  const {course}=await h.createCourse(),entry=await h.create(h.enrolment(course));
  assert.equal((await h.call(h.enrolment(course))).status,409);
  assert.equal((await h.call({...entry,status:'active',actorId:'forged'})).status,200);
  assert.equal((await h.call({...entry,status:'revoked'})).status,409);
  assert.equal((await h.call({...entry,version:2,learnerId:other.userId})).status,400);
  const audit=h.db.prepare('SELECT * FROM enrolment_audit ORDER BY id').all();assert.equal(audit.length,2);assert.equal(audit[1].actor_id,owner.userId);assert.equal(JSON.parse(audit[1].previous_json).status,'pending');assert.equal(JSON.parse(audit[1].next_json).status,'active');
 }finally{h.db.close()}
});

test('enrolment history survives migration reapplication and rejects deletion/tampering',async()=>{
 const h=setup();try{
  const {course}=await h.createCourse();await h.create(h.enrolment(course));
  assert.throws(()=>h.db.exec('DELETE FROM programme_enrolments'),/Revoke enrolments/);
  assert.throws(()=>h.db.exec('DELETE FROM enrolment_audit'),/append-only/);
  assert.throws(()=>h.db.exec("UPDATE enrolment_audit SET reason='tampered'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0006_programme_enrolments.sql','utf8'));
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_enrolments').get().n,1);
  assert.deepEqual(h.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{h.db.close()}
});

test('enrolment audit failure rolls back its write',async()=>{
 const h=setup();try{
  const {course}=await h.createCourse();h.db.exec("CREATE TRIGGER block_enrolment_audit BEFORE INSERT ON enrolment_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
  assert.equal((await h.call(h.enrolment(course))).status,503);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM programme_enrolments').get().n,0);
 }finally{h.db.close()}
});
