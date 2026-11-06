import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminFacultyEndpoint,facultyEndpoint,hasTeachingAccess} from '../lib/faculty-service.mjs';
import {contentEndpoint} from '../lib/content-service.mjs';
import {resourceEndpoint} from '../lib/resource-service.mjs';
import {adminEnrolmentEndpoint} from '../lib/enrolment-service.mjs';
import {adminEndpoint,emptyProgress,roleFor} from '../lib/progress-service.mjs';
import catalogue from '../lib/resource-catalogue.json' with {type:'json'};

const owner={userId:'owner',email:'owner@example.test'},teacher={userId:'teacher-a',email:'a@example.test'},other={userId:'teacher-b',email:'b@example.test'},student={userId:'student',email:'student@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql',...['0004_content_manager','0005_programme_resources','0006_programme_enrolments','0007_faculty_assignments'].map(name=>`docs/migrations/${name}.sql`)])db.exec(readFileSync(file,'utf8'));
 for(const user of [owner,teacher,other,student])db.prepare('INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES(?,?,?,?,?,1,1)').run(user.userId,user.email,user.userId,user===owner?'Admin':'Student',JSON.stringify(emptyProgress()));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){const result=statement.run(...values);return{meta:{changes:Number(result.changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test',url='https://local.test/api/admin/faculty')=>new Request(url,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>adminFacultyEndpoint(request(method,body,origin),user,env);
 const mine=(user=teacher,url='https://local.test/api/faculty')=>facultyEndpoint(request('GET',undefined,undefined,url),user,env);
 async function node(kind,parentId=null,title='Synthetic '+kind){const body={kind,parentId,title,description:'',status:'draft',sortOrder:1,reason:'Create faculty test programme'};const response=await contentEndpoint(request('POST',body),owner,env);assert.equal(response.status,201);return{...body,...await response.json()};}
 const assignment=(course,changes={})=>({courseId:course.id,facultyId:teacher.userId,enabled:false,reason:'Assign teaching review',...changes});
 async function create(body){const response=await call(body);assert.equal(response.status,201,await response.clone().text());return{...body,...await response.json()};}
 return{db,env,DB,request,call,mine,node,assignment,create};
}

test('faculty assignment management is Admin-only; workspace is signed-in read-only',async()=>{
 const h=setup();try{
  for(const user of [null,teacher])for(const body of [undefined,{}])assert.equal((await h.call(body,user)).status,403);
  assert.equal((await h.mine(null)).status,401);
  assert.equal((await facultyEndpoint(h.request('POST',{}),teacher,h.env)).status,405);
  assert.equal((await h.call({},owner,'POST','https://other.test')).status,403);
  assert.equal((await h.call({},owner,'DELETE')).status,405);
  assert.equal((await(await h.mine()).json()).courses.length,0);
 }finally{h.db.close()}
});

test('only saved non-Admin accounts and courses can receive faculty assignments',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id),base=h.assignment(course);
  for(const changes of [{facultyId:'unknown'},{facultyId:owner.userId},{courseId:division.id},{courseId:crypto.randomUUID()},{enabled:'yes'},{reason:''}])assert.equal((await h.call({...base,...changes})).status,400);
  const data=await(await h.call()).json();assert(data.accounts.every(account=>account.id!==owner.userId));assert.equal(data.courses.length,1);
 }finally{h.db.close()}
});

test('enabled course grants scope draft nodes, resources and aggregate counts without leaking another course or roster',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id,'Assigned course'),foreign=await h.node('course',division.id,'Other private course'),subject=await h.node('subject',course.id),unit=await h.node('module',subject.id);
  await h.create(h.assignment(course,{enabled:true}));await h.create(h.assignment(foreign,{facultyId:other.userId,enabled:true}));
  const note=catalogue.find(resource=>resource.kind==='note');
  for(const target of [unit,foreign])assert.equal((await resourceEndpoint(h.request('POST',{nodeId:target.id,kind:'note',resourceId:note.id,enabled:false,sortOrder:1,reason:'Prepare free material link'}),owner,h.env)).status,201);
  for(const target of [course,foreign])assert.equal((await adminEnrolmentEndpoint(h.request('POST',{nodeId:target.id,learnerId:student.userId,status:'active',startsAt:0,endsAt:null,reason:'Record synthetic enrolment'}),owner,h.env)).status,201);
  const data=await(await h.mine(teacher,`https://local.test/api/faculty?facultyId=${other.userId}&courseId=${foreign.id}`)).json();
  assert.equal(data.mode,'read_only');assert.equal(data.courses.length,1);assert.equal(data.courses[0].id,course.id);assert.equal(data.courses[0].activeEnrolments,1);
  assert.equal(data.nodes.length,3);assert(data.nodes.every(node=>node.id!==foreign.id&&node.id!==division.id));assert.equal(data.resources.length,1);assert.equal(data.resources[0].nodeId,unit.id);
  const serialized=JSON.stringify(data);for(const privateValue of [student.email,student.userId,foreign.title,other.email,'facultyId','actorId','reason','learnerId'])assert(!serialized.includes(privateValue),privateValue);
 }finally{h.db.close()}
});

test('disabling a grant removes teaching access without changing the two base roles or granting Admin APIs',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id),grant=await h.create(h.assignment(course));
  assert.equal(await hasTeachingAccess(teacher,h.env),false);
  assert.equal((await h.call({...grant,enabled:true})).status,200);assert.equal(await hasTeachingAccess(teacher,h.env),true);assert.equal(roleFor(teacher,h.env),'Student');
  for(const handler of [adminFacultyEndpoint,contentEndpoint,resourceEndpoint,adminEnrolmentEndpoint,adminEndpoint])assert.equal((await handler(h.request(),teacher,h.env)).status,403);
  assert.equal((await h.call({...grant,version:2,enabled:false})).status,200);
  assert.equal(await hasTeachingAccess(teacher,h.env),false);assert.equal((await(await h.mine()).json()).nodes.length,0);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM faculty_assignments').get().n,1);
 }finally{h.db.close()}
});

test('faculty assignments reject stale/duplicate/identity changes and preserve trusted audit history',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id),grant=await h.create(h.assignment(course));
  assert.equal((await h.call(h.assignment(course))).status,409);
  assert.equal((await h.call({...grant,enabled:true,actorId:'forged'})).status,200);
  assert.equal((await h.call({...grant,enabled:false})).status,409);
  assert.equal((await h.call({...grant,version:2,facultyId:other.userId})).status,400);
  const audit=h.db.prepare('SELECT * FROM faculty_audit ORDER BY id').all();assert.equal(audit.length,2);assert.equal(audit[1].actor_id,owner.userId);assert.equal(JSON.parse(audit[1].previous_json).enabled,0);assert.equal(JSON.parse(audit[1].next_json).enabled,1);
  assert.throws(()=>h.db.exec('DELETE FROM faculty_assignments'),/Disable faculty/);assert.throws(()=>h.db.exec('DELETE FROM faculty_audit'),/append-only/);assert.throws(()=>h.db.exec("UPDATE faculty_audit SET reason='tampered'"),/append-only/);
  h.db.exec(readFileSync('docs/migrations/0007_faculty_assignments.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM faculty_audit').get().n,2);
 }finally{h.db.close()}
});

test('revocation during a multi-query teaching read suppresses already-fetched course data',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id);await h.create(h.assignment(course,{enabled:true}));
  const env={...h.env,DB:{prepare(sql){if(sql.startsWith('SELECT course_id AS courseId FROM faculty_assignments'))h.db.exec("UPDATE faculty_assignments SET enabled=0,version=version+1,change_reason='Disable during read'");return h.DB.prepare(sql);}}};
  const data=await(await facultyEndpoint(h.request(),teacher,env)).json();assert.equal(data.courses.length,0);assert.equal(data.nodes.length,0);assert.equal(data.resources.length,0);
 }finally{h.db.close()}
});

test('faculty audit failures roll back assignments and missing capability tables fail closed',async()=>{
 const h=setup();try{
  const division=await h.node('division'),course=await h.node('course',division.id);h.db.exec("CREATE TRIGGER block_faculty_audit BEFORE INSERT ON faculty_audit BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
  assert.equal((await h.call(h.assignment(course))).status,503);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM faculty_assignments').get().n,0);
  assert.equal(await hasTeachingAccess(teacher,{PORTAL_ADMIN_EMAIL:owner.email,DB:{prepare(){throw Error('Missing migration');}}}),false);
 }finally{h.db.close()}
});
