import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminFacultyNotesEndpoint,facultyNotesEndpoint} from '../lib/faculty-note-service.mjs';
import {publicMaterialsEndpoint} from '../lib/material-service.mjs';
const owner={userId:'owner',email:'owner@example.test'},teacher={userId:'teacher',email:'teacher@example.test'},other={userId:'other',email:'other@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['drizzle/0000_far_dust.sql',...['0004_content_manager','0005_programme_resources','0007_faculty_assignments','0008_authored_materials','0009_faculty_note_review'].map(name=>`docs/migrations/${name}.sql`)])db.exec(readFileSync(file,'utf8'));
 for(const user of [owner,teacher,other])db.prepare('INSERT INTO learner_progress(user_id,email,display_name,role,payload,version,updated_at) VALUES(?,?,?,?,?,1,1)').run(user.userId,user.email,user.userId,user===owner?'Admin':'Student','{}');
 const division=crypto.randomUUID(),course=crypto.randomUUID(),foreign=crypto.randomUUID(),grant=crypto.randomUUID(),foreignGrant=crypto.randomUUID();
 db.prepare("INSERT INTO content_nodes(id,kind,title,changed_by,change_reason,updated_at) VALUES(?,'division','Synthetic division','owner','Synthetic setup',1)").run(division);
 for(const [id,title] of [[course,'Assigned course'],[foreign,'Unrelated secret course']])db.prepare("INSERT INTO content_nodes(id,kind,parent_id,title,changed_by,change_reason,updated_at) VALUES(?,'course',?,?,'owner','Synthetic setup',1)").run(id,division,title);
 for(const [id,courseId,userId] of [[grant,course,teacher.userId],[foreignGrant,foreign,other.userId]])db.prepare("INSERT INTO faculty_assignments(id,course_id,faculty_id,enabled,changed_by,change_reason,updated_at) VALUES(?,?,?,1,'owner','Synthetic assignment',1)").run(id,courseId,userId);
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const request=(method='GET',body,origin='https://local.test',path='/api/faculty-notes')=>new Request('https://local.test'+path,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const mine=(body,user=teacher,method=body?'POST':'GET',origin)=>facultyNotesEndpoint(request(method,body,origin),user,env);
 const admin=(body,user=owner,method=body?'POST':'GET',origin)=>adminFacultyNotesEndpoint(request(method,body,origin),user,env);
 const base={courseId:course,title:'Synthetic note',category:'Grammar',body:'Rule and example. ಕನ್ನಡ.',status:'draft',reason:'Prepare course note'};
 async function allow(assignmentId=grant){const r=await admin({action:'access',assignmentId,enabled:true,version:0,reason:'Enable note submissions'});assert.equal(r.status,200,await r.clone().text());}
 async function create(changes={},user=teacher){const body={...base,...changes},r=await mine(body,user);assert.equal(r.status,201,await r.clone().text());return{...body,...await r.json()};}
 const review=(note,decision='accepted')=>admin({action:'review',id:note.id,version:note.version,decision,reason:'Check and review note'});
 return{db,env,DB,request,mine,admin,base,course,foreign,grant,foreignGrant,allow,create,review};
}

test('faculty note submission requires separate opt-in permission and retains Admin/Student boundary',async()=>{
 const h=setup();try{
  assert.equal((await h.mine()).status,200);assert.equal((await(await h.mine()).json()).courses.length,0);assert.equal((await h.mine(h.base)).status,403);
  assert.equal((await h.mine(undefined,null)).status,401);assert.equal((await h.mine(h.base,owner)).status,403);assert.equal((await h.admin(undefined,teacher)).status,403);assert.equal((await h.admin({},teacher)).status,403);
  await h.allow();assert.equal((await(await h.mine()).json()).courses.length,1);await h.create();
  assert.equal((await h.mine(h.base,teacher,'POST','https://other.test')).status,403);assert.equal((await h.admin({},owner,'POST','https://other.test')).status,403);
  assert.equal((await h.mine({},teacher,'DELETE')).status,405);assert.equal((await h.admin({},owner,'DELETE')).status,405);
 }finally{h.db.close()}
});
test('faculty can read and edit only their own drafts within an enabled course, ignoring forged identity',async()=>{
 const h=setup();try{
  await h.allow();await h.allow(h.foreignGrant);const note=await h.create({authorId:other.userId}),secret=await h.create({courseId:h.foreign,title:'SECRET OTHER NOTE'},other);
  const data=await(await facultyNotesEndpoint(h.request('GET',undefined,undefined,'/api/faculty-notes?authorId=other&courseId='+h.foreign),teacher,h.env)).json();
  assert.equal(data.proposals.length,1);assert.equal(data.proposals[0].id,note.id);assert(!JSON.stringify(data).includes('SECRET'));assert(!JSON.stringify(data).includes('authorId'));
  assert.equal((await h.mine({...secret,body:'Stolen edit'})).status,409);assert.equal((await h.mine({...note,courseId:h.foreign})).status,409);assert.equal((await h.mine({...h.base,courseId:h.foreign})).status,403);
  assert.equal((await h.mine({...note,status:'published'})).status,400);assert.equal((await h.mine({...h.base,status:'submitted'})).status,400);
  const audit=h.db.prepare('SELECT * FROM faculty_note_audit WHERE proposal_id=?').get(note.id);assert.equal(audit.actor_id,teacher.userId);assert.equal(JSON.parse(audit.next_json).author_id,teacher.userId);
 }finally{h.db.close()}
});
test('submission locks the text; Admin can return feedback, then accept a revised version into a hidden Admin draft',async()=>{
 const h=setup();try{
  await h.allow();const note=await h.create();assert.equal((await h.mine({...note,status:'submitted'})).status,200);
  assert.equal((await h.mine({...note,version:2,body:'Edit after submission'})).status,409);
  assert.equal((await h.review({...note,version:2},'returned')).status,200);
  let data=await(await h.mine()).json();assert.equal(data.proposals[0].status,'draft');assert.equal(data.proposals[0].reviewNote,'Check and review note');
  assert.equal((await h.mine({...note,version:3,status:'submitted',body:'Revised body'})).status,200);
  const accepted=await h.review({...note,version:4});assert.equal(accepted.status,200);assert.equal((await accepted.json()).materialId,'authored-'+note.id);
  const material=h.db.prepare('SELECT * FROM authored_materials').get();assert.equal(material.status,'draft');assert.equal(material.body,'Revised body');assert.equal(material.changed_by,owner.userId);
  const link=h.db.prepare('SELECT * FROM programme_resources').get();assert.equal(link.enabled,0);assert.equal(link.node_id,h.course);assert.equal(link.resource_id,material.id);
  const publicResponse=await publicMaterialsEndpoint(h.request('GET',undefined,undefined,'/api/materials?id='+material.id),h.env);assert.equal(publicResponse.status,404);
  assert.equal((await h.review({...note,version:5})).status,409);assert.equal((await h.mine({...note,version:5})).status,409);
 }finally{h.db.close()}
});
test('permission and teaching revocation remove reads and writes, including revocation immediately before a mutation',async()=>{
 const h=setup();try{
  await h.allow();const note=await h.create();
  assert.equal((await h.admin({action:'access',assignmentId:h.grant,enabled:false,version:1,reason:'Revoke submissions'})).status,200);
  assert.equal((await(await h.mine()).json()).proposals.length,0);assert.equal((await h.mine({...note,body:'Forbidden'})).status,409);assert.equal((await h.mine(h.base)).status,403);
  assert.equal((await h.admin({action:'access',assignmentId:h.grant,enabled:true,version:2,reason:'Restore submissions'})).status,200);
  const env={...h.env,DB:{prepare(sql){if(sql.startsWith('UPDATE faculty_note_proposals AS p'))h.db.exec("UPDATE faculty_assignments SET enabled=0,version=version+1,change_reason='Revoke before write'");return h.DB.prepare(sql);}}};
  assert.equal((await facultyNotesEndpoint(h.request('POST',{...note,status:'submitted'}),teacher,env)).status,409);assert.equal(h.db.prepare('SELECT status FROM faculty_note_proposals').get().status,'draft');assert.equal((await(await h.mine()).json()).courses.length,0);
  assert.equal((await h.mine(h.base)).status,403);
 }finally{h.db.close()}
});
test('stale access/review versions, rejection and immutable transitions do not create duplicate notes or destroy history',async()=>{
 const h=setup();try{
  await h.allow();assert.equal((await h.admin({action:'access',assignmentId:h.grant,enabled:false,version:0,reason:'Stale permission'})).status,409);
  const note=await h.create();assert.equal((await h.review(note)).status,409);await h.mine({...note,status:'submitted'});
  assert.equal((await h.review(note)).status,409);assert.equal((await h.review({...note,version:2},'rejected')).status,200);assert.equal((await h.mine({...note,version:3})).status,409);
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM authored_materials').get().n,0);
  for(const table of ['faculty_note_access_audit','faculty_note_audit']){assert.throws(()=>h.db.exec('DELETE FROM '+table),/append-only/);assert.throws(()=>h.db.exec("UPDATE "+table+" SET reason='tamper'"),/append-only/);}
  assert.throws(()=>h.db.exec('DELETE FROM faculty_note_proposals'),/Retain proposal/);assert.throws(()=>h.db.exec('DELETE FROM faculty_note_access'),/Disable submission/);
  assert.throws(()=>h.db.prepare('UPDATE faculty_note_proposals SET course_id=?').run(h.foreign),/Invalid proposal/);
  h.db.exec(readFileSync('docs/migrations/0009_faculty_note_review.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM faculty_note_audit').get().n,3);
 }finally{h.db.close()}
});
test('acceptance rolls back proposal, material, link and every audit if any dependent audit write fails',async()=>{
 for(const blocked of ['material_audit','resource_audit','faculty_note_audit']){
  const h=setup();try{
   await h.allow();const note=await h.create();await h.mine({...note,status:'submitted'});
   h.db.exec("CREATE TRIGGER reject_approval BEFORE INSERT ON "+blocked+" BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END;");
   assert.equal((await h.review({...note,version:2})).status,503);
   assert.equal(h.db.prepare('SELECT status FROM faculty_note_proposals').get().status,'submitted');
   for(const table of ['authored_materials','programme_resources','material_audit','resource_audit'])assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n,0);
   assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM faculty_note_audit').get().n,2);
  }finally{h.db.close()}
 }
});
test('review remains available to Admin after faculty revocation, while acceptance never restores submission permissions',async()=>{
 const h=setup();try{
  await h.allow();const note=await h.create();await h.mine({...note,status:'submitted'});
  h.db.exec("UPDATE faculty_assignments SET enabled=0,version=version+1,change_reason='Revoke teaching access'");
  assert.equal((await h.review({...note,version:2})).status,200);assert.equal((await(await h.mine()).json()).proposals.length,0);
  assert.equal(h.db.prepare('SELECT enabled FROM faculty_assignments WHERE id=?').get(h.grant).enabled,0);
 }finally{h.db.close()}
});
test('faculty note fields enforce bounded valid text and do not expose full audit snapshots in Admin summary lists',async()=>{
 const h=setup();try{
  await h.allow();for(const changes of [{title:'a'.repeat(121)},{body:'a'.repeat(20001)},{body:' '},{category:''},{reason:'ab'},{courseId:'fake'}])assert.equal((await h.mine({...h.base,...changes})).status,400);
  const note=await h.create();const data=await(await h.admin()).json();assert.equal(data.proposals[0].body,note.body);assert(!('nextJson' in data.audit[0]));
 }finally{h.db.close()}
});
