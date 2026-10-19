// Run only the built Worker locally, with disposable state and no real identity.
import './sites-env.mjs';
import assert from 'node:assert/strict';
import {syntheticPdf} from '../tests/fixtures/pdf.mjs';
import resourceCatalogue from '../lib/resource-catalogue.json' with {type:'json'};
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const roles = process.argv.includes('--roles');
assert(process.argv.slice(2).every(x => x === '--roles'), 'Only --roles is supported');

const config = resolve('dist/server/wrangler.json');
const binding = JSON.parse(readFileSync(config, 'utf8')).d1_databases?.find(x => x.binding === 'DB');
assert.equal(binding?.database_id, '00000000-0000-4000-8000-000000000000');
assert.equal(JSON.parse(readFileSync(config,'utf8')).r2_buckets?.find(bucket=>bucket.binding==='BUCKET')?.bucket_name,'site-creator-r2','Only the local R2 binding is allowed');
mkdirSync('.wrangler', { recursive: true });
const state = mkdtempSync(resolve('.wrangler/smoke-'));
if (roles) {
  const files = ['drizzle/0000_far_dust.sql', ...['0001_social_links', '0002_community_membership', '0003_finance_reconciliation','0004_content_manager','0005_programme_resources','0006_programme_enrolments','0007_faculty_assignments','0008_authored_materials','0009_faculty_note_review','0010_pdf_materials','0011_finance_import_staging','0012_finance_review','0013_finance_evidence_decisions','0014_finance_payment_links','0015_cross_batch_payment_links','0016_finance_approval_snapshots'].map(n => `docs/migrations/${n}.sql`)];
  const sql = join(state, 'schema.sql');
  writeFileSync(sql, files.map(f => readFileSync(f, 'utf8')).join('\n'));
  const migration = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--config', config, '--local', '--persist-to', state, '--file', sql, '--json'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(migration.status, 0, migration.stderr + migration.stdout);
  assert(JSON.parse(migration.stdout).every(x => x.success));
}
const base = 'http://127.0.0.1:8793';
const worker = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--config', config, '--local', '--persist-to', state, '--ip', '127.0.0.1', '--port', '8793', '--inspector-port', '0', ...(roles ? ['--var', 'PORTAL_ADMIN_EMAIL:owner@example.test'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
try {
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(Error('Local Worker startup timed out')), 30000);
    const finish = fn => value => { clearTimeout(timeout); fn(value); };
    worker.once('error', finish(reject));
    worker.once('exit', finish(code => reject(Error(`Worker exited early: ${code}`))));
    const output = chunk => {
      logs += chunk.toString();
      if (logs.includes('Ready on ' + base)) finish(resolveReady)();
    };
    worker.stdout.on('data', output);
    worker.stderr.on('data', output);
  });
  const get = (path, options) => fetch(base + path, { signal: AbortSignal.timeout(10000), ...options });
  for (const path of ['/', '/portal.bundle.js', '/manifest.webmanifest', '/sw.js', '/offline.html', '/finance-import-template.csv']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
    console.log('PASS public runtime', path);
  }
  const legacy = await get('/index.html', { redirect: 'manual' });
  assert([301, 302, 307, 308].includes(legacy.status));
  assert.equal(new URL(legacy.headers.get('location'), base).pathname, '/');
  console.log('PASS legacy redirect');
  for (const path of ['/api/admin/social-links', '/api/admin/community', '/api/admin/learning', '/api/admin/content', '/api/admin/resources', '/api/admin/enrolments', '/api/admin/faculty', '/api/admin/materials', '/api/admin/faculty-notes', '/api/admin/finance-imports','/api/admin/finance-approvals','/api/admin/finance-payment-links','/api/admin/finance-evidence','/api/admin/finance-ledger-preview','/api/admin/finance-review', '/api/admin/files', '/api/admin/files/download', '/api/progress', '/api/enrolments', '/api/faculty', '/api/faculty-notes', '/api/admin/finance-preview']) {
    const response = await get(path, path.endsWith('finance-preview') ? {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ transactions: [] }),
    } : {});
    assert([401, 403].includes(response.status), `${path}: ${response.status}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    console.log('PASS anonymous API blocked and uncached', path);
  }
  if (roles) {
    // Simulates identity headers normally set by the trusted hosting gateway.
    // This checks application roles, not the provider's sign-in/gateway boundary.
    const identities = {
      owner: { 'oai-authenticated-user-id': 'synthetic-owner', 'oai-authenticated-user-email': 'owner@example.test' },
      student: { 'oai-authenticated-user-id': 'synthetic-student', 'oai-authenticated-user-email': 'student@example.test' },
      other: { 'oai-authenticated-user-id': 'synthetic-other', 'oai-authenticated-user-email': 'other@example.test' },
    };
    async function api(path, role, method = 'GET', body, status = 200, origin = base) {
      const response = await get(path, { method, headers: { ...identities[role], origin, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(response.status, status, `${role} ${method} ${path}: ${response.status === status ? '' : await response.text()}`);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      return response.json();
    }
    for (const role of ['owner', 'student']) {
      const page = await get('/', { headers: identities[role] });
      const html = await page.text();
      assert.match(html,/id="public-social-links"/);
      const identity = JSON.parse(html.match(/<script id="portal-identity"[^>]*>(.*?)<\/script>/s)?.[1] ?? 'null');
      assert.equal(identity?.role, role === 'owner' ? 'Admin' : 'Student');
    }
    for (const path of ['/api/admin/social-links', '/api/admin/community', '/api/admin/learning', '/api/admin/content', '/api/admin/resources', '/api/admin/enrolments', '/api/admin/faculty', '/api/admin/materials', '/api/admin/faculty-notes', '/api/admin/finance-imports','/api/admin/finance-approvals','/api/admin/finance-payment-links','/api/admin/finance-evidence','/api/admin/finance-ledger-preview','/api/admin/finance-review', '/api/admin/files', '/api/admin/files/download']) {
      await api(path, 'student', 'GET', undefined, 403);
      await api(path, 'owner', 'GET', undefined, path.endsWith('/files/download') ? 404 : 200);
    }
    await api('/api/admin/finance-preview', 'student', 'POST', { transactions: [] }, 403);
    console.log('PASS simulated owner/student identities and Admin authorization across built routes');

    const initial = await api('/api/progress', 'student');
    assert.equal(initial.version, 0);
    await api('/api/progress', 'student', 'PUT', { version: 0, payload: { ...initial.payload, goal: 7 } });
    assert.equal((await api('/api/progress', 'student')).payload.goal, 7);
    assert.equal((await api('/api/progress', 'other')).version, 0);
    await api('/api/progress', 'student', 'PUT', { version: 0, payload: initial.payload }, 409);
    const owner = await api('/api/progress', 'owner');
    await api('/api/progress', 'owner', 'PUT', { version: 0, payload: owner.payload });
    assert.equal((await api('/api/admin/learning', 'owner')).learnerCount, 1);
    console.log('PASS progress persistence, user isolation, stale-save conflicts and Admin exclusion');

    const link = { platform: 'website', label: 'Synthetic local test', url: 'https://example.test', enabled: false, sortOrder: 1 };
    const created = await api('/api/admin/social-links', 'owner', 'POST', link, 201);
    const publicLinks=async()=>{const response=await get('/api/social-links');assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);return(await response.json()).links;};
    assert.equal((await publicLinks()).length,0);
    await api('/api/admin/social-links', 'owner', 'POST', { ...link, id: created.id, enabled: true });
    assert.equal((await api('/api/admin/social-links', 'owner')).links[0].enabled, true);
    const published=await publicLinks();assert.equal(published.length,1);assert.deepEqual(Object.keys(published[0]).sort(),['label','platform','url']);
    await api('/api/admin/social-links','owner','POST',{...link,platform:'youtube',enabled:true},400);
    await api('/api/admin/social-links', 'owner', 'DELETE', { id: created.id });
    assert.equal((await api('/api/admin/social-links', 'owner')).links.length, 0);
    assert.equal((await publicLinks()).length,0);
    console.log('PASS public social publication, hidden drafts, destination rules and immediate removal');
    const group = await api('/api/admin/community', 'owner', 'POST', { action: 'createGroup', platform: 'telegram', title: 'Synthetic local group', programme: 'English', accessTier: 'premium_course' }, 201);
    await api('/api/admin/community', 'owner', 'POST', { action: 'setGroupEnabled', id: group.id, enabled: true });
    const member = { action: 'upsertMembership', groupId: group.id, learnerId: 'synthetic-student', membershipStatus: 'pending', paymentStatus: 'pending_verification' };
    await api('/api/admin/community', 'owner', 'POST', member);
    await api('/api/admin/community', 'owner', 'POST', { ...member, membershipStatus: 'confirmed' });
    const community = await api('/api/admin/community', 'owner');
    assert.equal(community.groups[0].enabled, 1);
    assert.equal(community.memberships.length, 1);
    assert.equal(community.memberships[0].verifiedAt, null);
    console.log('PASS persisted social CRUD, group enable and membership upsert through built Worker/D1');

    for (const path of ['/api/admin/social-links', '/api/admin/community', '/api/admin/finance-preview']) {
      await api(path, 'owner', 'POST', {}, 403, 'https://other.example.test');
    }
    await api('/api/admin/finance-preview', 'owner', 'POST', { transactions: Array(201).fill({}) }, 400);
    await api('/api/admin/finance-preview', 'owner', 'POST', { transactions: [], padding: 'x'.repeat(100001) }, 413);
    const transaction = { source: 'phonepe', externalReference: 'synthetic-1', transactionKind: 'tuition', grossPaise: 99900, netPaise: 99900, paidAt: '2026-10-19' };
    const preview = await api('/api/admin/finance-preview', 'owner', 'POST', { transactions: [transaction, transaction, { ...transaction, netPaise: -1 }] });
    assert.equal(preview.previewOnly, true);
    assert.equal(preview.acceptedCount, 1);
    assert.equal(preview.duplicates.length, 1);
    assert.equal(preview.rejected.length, 1);
    assert.equal(preview.totals.netPaise, 99900);
    console.log('PASS Admin origin checks, finance row limit, duplicates and invalid amounts');
    const programme = {kind:'division',parentId:null,title:'Synthetic division',description:'ಕ'.repeat(1000),status:'draft',sortOrder:1,reason:'Validate programme manager'};
    const division = await api('/api/admin/content','owner','POST',programme,201);
    const course = {...programme,kind:'course',parentId:division.id,title:'Synthetic course',status:'published'};
    await api('/api/admin/content','owner','POST',course,400);
    await api('/api/admin/content','owner','POST',{...programme,...division,status:'published'});
    await api('/api/admin/content','owner','POST',course,201);
    const publicProgrammes = async () => {
      const response=await get('/api/catalogue');assert.equal(response.status,200);
      return (await response.json()).programmes;
    };
    assert.equal((await publicProgrammes()).length,2);
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:2,status:'paused'});
    assert.equal((await publicProgrammes()).length,0);
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:2,status:'published'},409);
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:3,status:'published'});
    assert.equal((await publicProgrammes()).length,2);
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:4,status:'archived'});
    assert.equal((await publicProgrammes()).length,0);
    const content=await api('/api/admin/content','owner');
    assert.equal(content.nodes.length,2);assert.equal(content.audit.length,6);
    assert(content.audit.every(entry=>entry.actorId==='synthetic-owner'));
    assert.equal((await api('/api/admin/learning','owner')).learnerCount,1);
    await api('/api/admin/content','owner','DELETE',{id:division.id},405);
    await api('/api/admin/content','owner','POST',programme,403,'https://other.example.test');
    console.log('PASS D1 programme hierarchy, publishing, pause/archive restoration, version conflicts and atomic audit');
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:5,status:'published'});
    const materialLinks=[];
    for(const [index,kind] of ['video','note','test'].entries()){
      const resource=resourceCatalogue.find(item=>item.kind===kind);
      const body={nodeId:division.id,kind,resourceId:resource.id,enabled:true,sortOrder:index,reason:'Link synthetic test to existing free resource'};
      const created=await api('/api/admin/resources','owner','POST',body,201);materialLinks.push({...body,...created});
      await api('/api/admin/resources','owner','POST',body,409);
    }
    const publicMaterials=async()=>{const response=await get('/api/catalogue');assert.equal(response.status,200);return(await response.json()).resources;};
    assert.deepEqual((await publicMaterials()).map(item=>item.kind),['video','note','test']);
    await api('/api/admin/resources','owner','POST',{...materialLinks[0],enabled:false});
    assert.equal((await publicMaterials()).length,2);
    await api('/api/admin/resources','owner','POST',{...materialLinks[0],enabled:true},409);
    await api('/api/admin/resources','owner','POST',{...materialLinks[0],version:2,enabled:true});
    assert.equal((await publicMaterials()).length,3);
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:6,status:'archived'});
    assert.equal((await publicMaterials()).length,0);
    const materialState=await api('/api/admin/resources','owner');assert.equal(materialState.links.length,3);assert.equal(materialState.audit.length,5);
    await api('/api/admin/resources','owner','POST',{...materialLinks[0],resourceId:'preview-note-1792400000000'},400);
    await api('/api/admin/resources','owner','POST',{},403,'https://other.example.test');
    await api('/api/admin/resources','owner','DELETE',{id:materialLinks[0].id},405);
    console.log('PASS D1 resource linking, ordering, duplicates, visibility, conflicts and history preservation');
    await api('/api/admin/content','owner','POST',{...programme,id:division.id,version:7,status:'published'});
    const enrolledCourse=content.nodes.find(node=>node.kind==='course');
    const note=resourceCatalogue.find(resource=>resource.kind==='note');
    await api('/api/admin/resources','owner','POST',{nodeId:enrolledCourse.id,kind:'note',resourceId:note.id,enabled:true,sortOrder:1,reason:'Link a free note to enrolled course'},201);
    const enrolment={nodeId:enrolledCourse.id,learnerId:'synthetic-student',status:'pending',startsAt:0,endsAt:null,reason:'Synthetic website enrolment'};
    const enrolled=await api('/api/admin/enrolments','owner','POST',enrolment,201);
    let own=(await api('/api/enrolments','student')).enrolments[0];assert.equal(own.effectiveStatus,'pending');assert.equal(own.resources.length,0);
    await api('/api/admin/enrolments','owner','POST',{...enrolment,...enrolled,status:'active'});
    own=(await api('/api/enrolments?learnerId=synthetic-other','student')).enrolments[0];assert.equal(own.available,true);assert.equal(own.resources.length,1);assert(!('learnerId' in own));assert(!('reason' in own));
    assert.equal((await api('/api/enrolments?learnerId=synthetic-student','other')).enrolments.length,0);
    await api('/api/admin/enrolments','owner','POST',{...enrolment,...enrolled,version:2,status:'active',endsAt:1});
    own=(await api('/api/enrolments','student')).enrolments[0];assert.equal(own.effectiveStatus,'expired');assert.equal(own.resources.length,0);
    await api('/api/admin/enrolments','owner','POST',{...enrolment,...enrolled,version:3,status:'revoked'});
    assert.equal((await api('/api/enrolments','student')).enrolments[0].effectiveStatus,'revoked');
    await api('/api/admin/enrolments','owner','POST',{...enrolment,...enrolled,status:'active'},409);
    await api('/api/admin/enrolments','owner','POST',enrolment,409);
    await api('/api/admin/enrolments','owner','POST',{...enrolment,learnerId:'synthetic-owner'},400);
    await api('/api/admin/enrolments','owner','POST',{...enrolment,learnerId:'unknown-student'},400);
    await api('/api/admin/enrolments','student','POST',enrolment,403);
    await api('/api/enrolments','student','POST',enrolment,405);
    await api('/api/admin/enrolments','owner','POST',enrolment,403,'https://other.example.test');
    await api('/api/admin/enrolments','owner','DELETE',{id:enrolled.id},405);
    const roster=await api('/api/admin/enrolments','owner');assert.equal(roster.enrolments.length,1);assert.equal(roster.audit.length,4);assert(roster.learners.every(learner=>learner.id!=='synthetic-owner'));
    console.log('PASS D1 enrolment lifecycle, expiry, identity isolation, anti-self-approval and audit preservation');
    await api('/api/admin/enrolments','owner','POST',{...enrolment,...enrolled,version:4,status:'active'});
    const foreignCourse=await api('/api/admin/content','owner','POST',{...programme,kind:'course',parentId:division.id,title:'Unassigned private course',status:'draft'},201);
    const assignment={courseId:enrolledCourse.id,facultyId:'synthetic-student',enabled:false,reason:'Synthetic faculty assignment'};
    const grant=await api('/api/admin/faculty','owner','POST',assignment,201);
    assert.equal((await api('/api/faculty','student')).courses.length,0);
    await api('/api/admin/faculty','owner','POST',{...assignment,...grant,enabled:true});
    let faculty=(await api('/api/faculty?courseId='+foreignCourse.id+'&facultyId=synthetic-other','student'));
    assert.equal(faculty.courses.length,1);assert.equal(faculty.courses[0].id,enrolledCourse.id);assert.equal(faculty.courses[0].activeEnrolments,1);assert.equal(faculty.resources.length,1);
    assert(faculty.nodes.every(node=>node.id!==foreignCourse.id&&node.id!==division.id));assert(!JSON.stringify(faculty).includes('learnerId'));
    assert.equal((await api('/api/faculty?facultyId=synthetic-student','other')).courses.length,0);
    let teacherPage=await(await get('/',{headers:identities.student})).text();
    let teacherIdentity=JSON.parse(teacherPage.match(/<script id="portal-identity"[^>]*>(.*?)<\/script>/s)[1]);assert.equal(teacherIdentity.role,'Student');assert.equal(teacherIdentity.teachingAccess,true);
    for(const path of ['/api/admin/content','/api/admin/resources','/api/admin/enrolments','/api/admin/faculty','/api/admin/materials','/api/admin/faculty-notes','/api/admin/finance-imports','/api/admin/finance-approvals','/api/admin/finance-payment-links','/api/admin/finance-evidence','/api/admin/finance-ledger-preview','/api/admin/finance-review','/api/admin/files','/api/admin/community','/api/admin/social-links'])await api(path,'student','POST',{},403);
    await api('/api/admin/finance-preview','student','POST',{transactions:[]},403);
    await api('/api/faculty','student','POST',{},405);
    await api('/api/admin/faculty','owner','POST',{...assignment,...grant,version:2,enabled:false});
    faculty=await api('/api/faculty','student');assert.equal(faculty.courses.length,0);assert.equal(faculty.resources.length,0);
    teacherPage=await(await get('/',{headers:identities.student})).text();teacherIdentity=JSON.parse(teacherPage.match(/<script id="portal-identity"[^>]*>(.*?)<\/script>/s)[1]);assert.equal(teacherIdentity.teachingAccess,false);
    await api('/api/admin/faculty','owner','POST',{...assignment,...grant,enabled:true},409);
    await api('/api/admin/faculty','owner','POST',assignment,409);
    await api('/api/admin/faculty','owner','POST',{...assignment,facultyId:'synthetic-owner'},400);
    await api('/api/admin/faculty','owner','POST',assignment,403,'https://other.example.test');
    await api('/api/admin/faculty','owner','DELETE',{id:grant.id},405);
    const facultyRecords=await api('/api/admin/faculty','owner');assert.equal(facultyRecords.assignments.length,1);assert.equal(facultyRecords.audit.length,3);
    console.log('PASS D1 faculty course scope, aggregates, capability flag, immediate revocation and unchanged Admin/Student roles');
    const authored={title:'Synthetic authored note',category:'Grammar',body:'ಕನ್ನಡ '.repeat(1000)+'<script>plain text only</script>',status:'draft',reason:'Create synthetic draft'};
    const createdNote=await api('/api/admin/materials','owner','POST',authored,201);
    const publicNote=async(id,status=200)=>{const response=await get('/api/materials'+(id?'?id='+encodeURIComponent(id):''));assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/no-store/);return response.json();};
    assert.equal((await publicNote()).notes.length,0);await publicNote(createdNote.id,404);
    await api('/api/admin/resources','owner','POST',{nodeId:enrolledCourse.id,kind:'note',resourceId:createdNote.id,enabled:true,sortOrder:2,reason:'Attach authored draft'},201);
    assert(!(await publicMaterials()).some(item=>item.resourceId===createdNote.id));
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,status:'review'});await publicNote(createdNote.id,404);
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,version:2,status:'published'});
    assert.equal((await publicNote(createdNote.id)).note.body,authored.body);assert.equal((await publicNote()).notes.length,1);
    assert((await publicMaterials()).some(item=>item.resourceId===createdNote.id&&item.href==='#/material/'+createdNote.id));
    assert((await api('/api/enrolments','student')).enrolments[0].resources.some(item=>item.resourceId===createdNote.id));
    await api('/api/admin/faculty','owner','POST',{...assignment,...grant,version:3,enabled:true});
    assert((await api('/api/faculty','student')).resources.some(item=>item.resourceId===createdNote.id));
    await api('/api/admin/materials','student','POST',{...authored,...createdNote},403);
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,version:3,status:'archived'});
    await publicNote(createdNote.id,404);assert.equal((await publicNote()).notes.length,0);
    assert(!(await publicMaterials()).some(item=>item.resourceId===createdNote.id));
    assert(!(await api('/api/enrolments','student')).enrolments[0].resources.some(item=>item.resourceId===createdNote.id));
    assert(!(await api('/api/faculty','student')).resources.some(item=>item.resourceId===createdNote.id));
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,status:'published'},409);
    await api('/api/admin/materials','owner','POST',authored,403,'https://other.example.test');
    await api('/api/admin/materials','owner','DELETE',{id:createdNote.id},405);
    const notesState=await api('/api/admin/materials','owner');assert.equal(notesState.notes.length,1);assert.equal(notesState.audit.length,4);
    assert((await api('/api/admin/resources','owner')).links.some(item=>item.resourceId===createdNote.id));
    console.log('PASS D1 authored-note draft/review/publication/archive, Kannada body size, enrolment/faculty/resource projection and retained audit');
    assert.equal((await api('/api/faculty-notes','student')).courses.length,0);
    const proposal={courseId:enrolledCourse.id,title:'Synthetic faculty draft',category:'Grammar',body:'ಕನ್ನಡ '.repeat(1000)+'Rule and example',status:'draft',reason:'Prepare assigned course note'};
    await api('/api/faculty-notes','student','POST',proposal,403);
    const submissionAccess={action:'access',assignmentId:grant.id,enabled:true,version:0,reason:'Explicitly allow note submissions'};
    await api('/api/admin/faculty-notes','owner','POST',submissionAccess);
    await api('/api/admin/faculty-notes','owner','POST',submissionAccess,409);
    const savedProposal=await api('/api/faculty-notes','student','POST',proposal,201);
    assert.equal((await api('/api/faculty-notes?authorId=synthetic-student','other')).proposals.length,0);
    await api('/api/faculty-notes','student','POST',{...proposal,courseId:foreignCourse.id},403);
    await api('/api/faculty-notes','student','POST',{...proposal,...savedProposal,status:'submitted'});
    await api('/api/faculty-notes','student','POST',{...proposal,...savedProposal,version:2},409);
    await api('/api/admin/faculty-notes','student','POST',{action:'review',id:savedProposal.id,version:2,decision:'accepted',reason:'Forged approval'},403);
    const decision={action:'review',id:savedProposal.id,version:2,decision:'returned',reason:'Add a clearer example'};
    await api('/api/admin/faculty-notes','owner','POST',decision);
    assert.equal((await api('/api/faculty-notes','student')).proposals[0].reviewNote,decision.reason);
    await api('/api/faculty-notes','student','POST',{...proposal,...savedProposal,version:3,status:'submitted',body:'Revised note'});
    const accepted=await api('/api/admin/faculty-notes','owner','POST',{...decision,version:4,decision:'accepted'});
    assert.equal(accepted.materialId,'authored-'+savedProposal.id);
    await publicNote(accepted.materialId,404);
    const acceptedDraft=(await api('/api/admin/materials','owner')).notes.find(note=>note.id===accepted.materialId);assert.equal(acceptedDraft.status,'draft');assert.equal(acceptedDraft.body,'Revised note');
    const acceptedLink=(await api('/api/admin/resources','owner')).links.find(link=>link.resourceId===accepted.materialId);assert.equal(acceptedLink.enabled,false);assert.equal(acceptedLink.nodeId,enrolledCourse.id);
    await api('/api/admin/faculty-notes','owner','POST',{...decision,version:4,decision:'accepted'},409);
    await api('/api/admin/faculty-notes','owner','POST',{...submissionAccess,enabled:false,version:1});
    assert.equal((await api('/api/faculty-notes','student')).proposals.length,0);await api('/api/faculty-notes','student','POST',proposal,403);
    await api('/api/admin/faculty-notes','owner','POST',{...submissionAccess,version:2});
    const revokedDraft=await api('/api/faculty-notes','student','POST',proposal,201);
    await api('/api/admin/faculty','owner','POST',{...assignment,...grant,version:4,enabled:false});
    assert.equal((await api('/api/faculty-notes','student')).courses.length,0);await api('/api/faculty-notes','student','POST',{...proposal,...revokedDraft},409);
    await api('/api/faculty-notes','student','POST',proposal,403,'https://other.example.test');
    await api('/api/admin/faculty-notes','owner','DELETE',{},405);
    const reviewState=await api('/api/admin/faculty-notes','owner');assert.equal(reviewState.proposals.length,2);assert.equal(reviewState.audit.length,6);assert.equal(reviewState.accessAudit.length,3);
    console.log('PASS D1 opt-in faculty note access, private drafts, return/revise/accept into hidden Admin draft, conflicts and revocation');
    async function uploadPdf(role='owner',bytes=syntheticPdf(),status=201,origin=base){
      const form=new FormData();for(const [key,value] of Object.entries({title:'Synthetic local PDF',category:'Grammar',reason:'Review synthetic PDF upload',status:'published'}))form.append(key,value);form.append('file',new File([bytes],'synthetic.pdf',{type:'application/pdf'}));
      const response=await get('/api/admin/files',{method:'POST',headers:{...identities[role],origin},body:form});assert.equal(response.status,status,await response.clone().text());return response.json();
    }
    const pdfGet=async(id,status=200,admin=false)=>{const response=await get((admin?'/api/admin/files/download':'/api/files')+(id?'?id='+id:''),admin?{headers:identities.owner}:{});assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/no-store/);return response;};
    await uploadPdf('student',syntheticPdf(),403);await uploadPdf('owner',syntheticPdf(),403,'https://other.example.test');
    await uploadPdf('owner',new Uint8Array(5*1024*1024+1),413);
    const largePdf=new Uint8Array(2100000).fill(32),blankPdf=syntheticPdf();largePdf.set(blankPdf.slice(0,-6));largePdf.set(new TextEncoder().encode('%%EOF\n'),largePdf.length-6);
    const uploaded=await uploadPdf('owner',largePdf);assert.equal(uploaded.status,'draft');await pdfGet(uploaded.id,404);
    const privatePdf=await pdfGet(uploaded.id,200,true);assert.equal((await privatePdf.arrayBuffer()).byteLength,largePdf.length);assert.match(privatePdf.headers.get('content-disposition'),/^attachment/);
    const pdfDetails={...uploaded,title:'Synthetic local PDF',category:'Grammar',reason:'Publish reviewed local PDF'};
    await api('/api/admin/resources','owner','POST',{nodeId:enrolledCourse.id,kind:'note',resourceId:uploaded.id,enabled:true,sortOrder:3,reason:'Link uploaded PDF draft'},201);
    assert(!(await publicMaterials()).some(item=>item.resourceId===uploaded.id));
    await api('/api/admin/files','owner','POST',{...pdfDetails,status:'published'});
    assert.equal((await(await pdfGet()).json()).files.length,1);const publishedPdf=await pdfGet(uploaded.id);assert.equal(publishedPdf.headers.get('content-type'),'application/pdf');assert.equal(publishedPdf.headers.get('x-content-type-options'),'nosniff');assert.match(publishedPdf.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(new Uint8Array(await publishedPdf.arrayBuffer()),largePdf);
    assert((await publicMaterials()).some(item=>item.resourceId===uploaded.id&&item.href==='#/pdf/'+uploaded.id));
    assert((await api('/api/enrolments','student')).enrolments[0].resources.some(item=>item.resourceId===uploaded.id));
    await api('/api/admin/files','owner','POST',{...pdfDetails,status:'archived'},409);
    await api('/api/admin/files','owner','POST',{...pdfDetails,version:2,status:'archived'});await pdfGet(uploaded.id,404);await(await pdfGet(uploaded.id,200,true)).arrayBuffer();
    assert(!(await publicMaterials()).some(item=>item.resourceId===uploaded.id));assert(!(await api('/api/enrolments','student')).enrolments[0].resources.some(item=>item.resourceId===uploaded.id));assert.equal((await(await pdfGet()).json()).files.length,0);
    await api('/api/admin/files','owner','DELETE',{id:uploaded.id},405);const pdfState=await api('/api/admin/files','owner');assert.equal(pdfState.files.length,1);assert.equal(pdfState.audit.length,3);assert.equal(pdfState.storageAvailable,true);
    console.log('PASS local R2/D1 PDF upload over 2 MB, bounded rejection/recovery, private draft download, publication/archive and immutable audit');
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,version:4,status:'published'});
    await api('/api/admin/files','owner','POST',{...pdfDetails,version:3,status:'published'});
    const library=await api('/api/library?role=Admin','student');assert.deepEqual(new Set(library.notes.map(note=>note.id)),new Set([createdNote.id,uploaded.id]));assert(!JSON.stringify(library).includes('actorId'));assert(!JSON.stringify(library).includes('object_key'));assert(library.notes.every(note=>!('body' in note)&&!('status' in note)));
    assert.equal((await api('/api/library?id='+uploaded.id,'student')).note.source,'pdf');await api('/api/library?id='+accepted.materialId,'owner','GET',undefined,404);
    const learning=await api('/api/progress','student'),savedPayload={...learning.payload,saved:['homophones-100',createdNote.id,uploaded.id],read:[...new Set([...learning.payload.read,createdNote.id,uploaded.id])]};
    const savedLibrary=await api('/api/progress','student','PUT',{version:learning.version,payload:savedPayload});assert.deepEqual(savedLibrary.payload.saved,savedPayload.saved);assert.deepEqual(savedLibrary.unavailableResources,[]);
    const reloadedLibrary=await api('/api/progress','student');assert.deepEqual(reloadedLibrary.payload.read,savedPayload.read);assert.deepEqual(reloadedLibrary.payload.saved,savedPayload.saved);
    await api('/api/progress','student','PUT',{version:learning.version,payload:{...savedPayload,saved:[]}},409);
    await api('/api/admin/materials','owner','POST',{...authored,...createdNote,version:5,status:'archived'});
    await api('/api/admin/files','owner','POST',{...pdfDetails,version:4,status:'archived'});
    assert.equal((await api('/api/library','student')).notes.length,0);await api('/api/library?id='+createdNote.id,'student','GET',undefined,404);await api('/api/library?id='+uploaded.id,'student','GET',undefined,404);
    const retained=await api('/api/progress','student','PUT',{version:savedLibrary.version,payload:{...savedPayload,goal:6}});assert.deepEqual(retained.payload.saved,savedPayload.saved);assert.deepEqual(retained.unavailableResources,[]);
    const otherLearning=await api('/api/progress?userId=synthetic-student','other');assert(!otherLearning.payload.saved.includes(createdNote.id));
    const omitted=await api('/api/progress','other','PUT',{version:otherLearning.version,payload:{...otherLearning.payload,saved:[createdNote.id,uploaded.id],read:[createdNote.id]}});assert.deepEqual(omitted.payload.saved,[]);assert.deepEqual(omitted.payload.read,[]);assert.deepEqual(new Set(omitted.unavailableResources),new Set([createdNote.id,uploaded.id]));
    const removedBookmark=await api('/api/progress','student','PUT',{version:retained.version,payload:{...savedPayload,saved:['homophones-100'],goal:6}});assert.deepEqual(removedBookmark.payload.saved,['homophones-100']);assert(removedBookmark.payload.read.includes(uploaded.id));
    console.log('PASS D1 published library metadata, new note/PDF bookmarks and completion, stale conflicts, withdrawal retention/removal and cross-account isolation');
    const importRow={source:'phonepe',externalReference:'SYNTHETIC-STAGED-1',studentId:'synthetic-student',courseCode:'HSTR',transactionKind:'tuition',grossPaise:99900,feePaise:0,netPaise:99900,paidAt:'2026-10-19'};
    const importBody={requestId:crypto.randomUUID(),sourceLabel:'Synthetic mapped export',reason:'Test unverified staging',format:'json',data:JSON.stringify([importRow,importRow,{...importRow,externalReference:'BAD',netPaise:1},{...importRow,source:'appx',externalReference:'ACTIVATION-STAGED',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000}])};
    const imported=await api('/api/admin/finance-imports','owner','POST',importBody,201);assert.equal(imported.acceptedRows,2);assert.equal(imported.duplicateRows,1);assert.equal(imported.rejectedRows,1);assert.equal(imported.verification,'unverified');
    const replay=await api('/api/admin/finance-imports','owner','POST',importBody);assert.equal(replay.idempotentReplay,true);
    await api('/api/admin/finance-imports','owner','POST',{...importBody,reason:'Different input with same ID'},409);
    const reviewBatch=await api('/api/admin/finance-imports?batchId='+imported.batchId,'owner');assert.equal(reviewBatch.rows.length,4);assert.equal(reviewBatch.audit.length,1);assert(reviewBatch.stagingOnly);assert(reviewBatch.rows.some(row=>JSON.parse(row.flagsJson).includes('activation_match_pending')));
    const priorRefs=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),data:JSON.stringify([{...importRow,grossPaise:100,netPaise:100}])},201);assert.equal(priorRefs.duplicateRows,1);
    const csv='source,externalReference,transactionKind,grossPaise,feePaise,netPaise,paidAt\r\nphonepe,"CSV,LOCAL",tuition,99900,0,99900,2026-10-19\r\nphonepe,BAD-DATE,tuition,100,0,100,2026-02-30\r\n';
    const csvBatch=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),format:'csv',data:csv},201);assert.equal(csvBatch.acceptedRows,1);assert.equal(csvBatch.rejectedRows,1);
    const many=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),data:JSON.stringify(Array.from({length:200},(_,index)=>({...importRow,externalReference:'BULK-SYNTHETIC-'+index})))},201);assert.equal(many.acceptedRows,200);assert.equal((await api('/api/admin/finance-imports?batchId='+many.batchId,'owner')).rows.length,200);
    await api('/api/admin/finance-imports','student','POST',importBody,403);await api('/api/admin/finance-imports','owner','POST',importBody,403,'https://other.example.test');await api('/api/admin/finance-imports','owner','DELETE',{},405);
    const beforeReviewAccess=await api('/api/enrolments','student');
    const reviewInput={rowId:imported.batchId+':1',version:0,learnerId:'synthetic-student',nodeId:enrolledCourse.id,status:'reviewed',evidenceReference:'SYNTHETIC-EVIDENCE-ONLY',evidenceNotes:'Synthetic evidence reference, not real payment proof',reason:'Exercise saved matches'};
    const untouched=await api('/api/admin/finance-review?batchId='+imported.batchId,'owner');assert.equal(untouched.rows.length,2);assert(untouched.rows.every(row=>row.learnerId===null&&row.version===0));assert(!untouched.learners.some(row=>row.id==='synthetic-owner'));
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,learnerId:'synthetic-owner'},400);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:imported.batchId+':2'},400);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:imported.batchId+':3'},400);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,nodeId:division.id},400);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,evidenceReference:''},400);
    assert.equal((await api('/api/admin/finance-review','owner','POST',reviewInput,201)).version,1);
    await api('/api/admin/finance-review','owner','POST',reviewInput,409);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,version:1,status:'disputed',evidenceNotes:'Synthetic mismatch found',reason:'Reopen synthetic evidence'},200);
    const reviewed=await api('/api/admin/finance-review?batchId='+imported.batchId,'owner');assert.equal(reviewed.audit.length,2);assert.equal(reviewed.rows[0].status,'disputed');assert.equal(reviewed.rows[0].version,2);assert.equal(reviewed.verification,'unverified');assert.equal(JSON.parse(reviewed.audit[0].previousJson).status,'reviewed');
    await api('/api/admin/finance-review','student','POST',reviewInput,403);await api('/api/admin/finance-review','owner','POST',reviewInput,403,'https://other.example.test');await api('/api/admin/finance-review','owner','DELETE',{},405);
    assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 manual learner/programme matching, evidence history, review conflicts and unchanged Student access');
    const previewPath='/api/admin/finance-ledger-preview';
    const previewInput={batchId:imported.batchId,versions:[{rowId:reviewInput.rowId,version:2},{rowId:imported.batchId+':4',version:0}],links:[{rowId:imported.batchId+':4',targetRowId:reviewInput.rowId}]};
    assert.equal((await api(previewPath,'owner','POST',previewInput)).blockedCount,2);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,version:2,reason:'Resolve synthetic dispute'});
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:imported.batchId+':4',reason:'Review synthetic activation'},201);
    await api(previewPath,'owner','POST',previewInput,409);
    previewInput.versions=[{rowId:reviewInput.rowId,version:3},{rowId:imported.batchId+':4',version:1}];
    const ledgerPreview=await api(previewPath,'owner','POST',previewInput);assert.equal(ledgerPreview.blockedCount,0);assert.equal(ledgerPreview.canPost,false);assert.equal(ledgerPreview.verification,'unverified');assert.equal(ledgerPreview.totals.tuitionGrossPaise,99900);assert.equal(ledgerPreview.totals.activationGrossPaise,1500);assert.equal(ledgerPreview.totals.cashNetPaise,100900);assert(ledgerPreview.rows.every(row=>row.grantsCommunityAccess===false));
    await api(previewPath,'student','POST',previewInput,403);await api(previewPath,'owner','POST',previewInput,403,'https://other.example.test');await api(previewPath,'owner','DELETE',{},405);
    const reversalBatch=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),data:JSON.stringify([{...importRow,externalReference:'REVERSAL-SALE',grossPaise:10000,netPaise:10000},{...importRow,externalReference:'REVERSAL-A',transactionKind:'refund',grossPaise:4000,netPaise:4000},{...importRow,externalReference:'REVERSAL-B',transactionKind:'refund',grossPaise:7000,netPaise:7000}])},201);
    for(const number of [1,2,3])await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:reversalBatch.batchId+':'+number,reason:'Review synthetic reversal'},201);
    const reversalInput={batchId:reversalBatch.batchId,versions:[1,2,3].map(number=>({rowId:reversalBatch.batchId+':'+number,version:1})),links:[2,3].map(number=>({rowId:reversalBatch.batchId+':'+number,targetRowId:reversalBatch.batchId+':1'}))};
    const reversals=await api(previewPath,'owner','POST',reversalInput);assert.equal(reversals.blockedCount,2);assert.equal(reversals.totals.refundPaise,0);assert.equal(reversals.totals.tuitionGrossPaise,10000);assert.equal(reversals.totalsComplete,false);assert(reversals.rows.slice(1).every(row=>row.blockers.includes('refunds_exceed_original_gross')));
    assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 saved ledger preview, separate activation totals, stale-review protection, over-refund blocking and unchanged access');
    const evidencePath='/api/admin/finance-evidence';
    const evidenceInput={rowId:reviewInput.rowId,reviewVersion:3,version:0,status:'confirmed',method:'provider_statement',attested:true,notes:'Synthetic original provider evidence checked manually',reason:'Exercise synthetic attestation'};
    await api(evidencePath,'owner','POST',{...evidenceInput,attested:false},400);
    const attested=await api(evidencePath,'owner','POST',{...evidenceInput,snapshotJson:'FORGED',changedBy:'spoof'},201);assert(attested.manualAttestationOnly);assert.equal(attested.verification,'unverified');assert.equal(attested.canPost,false);
    await api(evidencePath,'owner','POST',evidenceInput,409);
    let evidenceRows=await api(evidencePath+'?batchId='+imported.batchId,'owner');assert.equal(evidenceRows.rows[0].effectiveState,'confirmed');assert.equal(evidenceRows.rows[0].decision.changedBy,'synthetic-owner');assert.equal(JSON.parse(evidenceRows.rows[0].decision.snapshotJson).transaction.grossPaise,99900);assert.equal(evidenceRows.audit.length,1);
    await api(evidencePath,'owner','POST',{...evidenceInput,rowId:imported.batchId+':4',reviewVersion:1},201);
    assert((await api(previewPath,'owner','POST',previewInput)).manualEvidenceComplete);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,version:3,evidenceNotes:'Synthetic corrected review note',reason:'Invalidate old evidence decision'});
    evidenceRows=await api(evidencePath+'?batchId='+imported.batchId,'owner');assert.equal(evidenceRows.rows[0].effectiveState,'stale');assert.equal(evidenceRows.rows[0].decision.status,'confirmed');assert.equal(evidenceRows.rows[0].decision.reviewVersion,3);assert.equal(evidenceRows.rows[0].reviewVersion,4);
    await api(evidencePath,'owner','POST',{...evidenceInput,version:1},409);
    previewInput.versions[0].version=4;const staleEvidence=await api(previewPath,'owner','POST',previewInput);assert.equal(staleEvidence.manualEvidenceComplete,false);assert.equal(staleEvidence.rows[0].evidenceState,'stale');assert.equal(staleEvidence.canPost,false);
    await api(evidencePath,'owner','POST',{...evidenceInput,version:1,reviewVersion:4,reason:'Recheck corrected review'});
    await api(evidencePath,'owner','POST',{...evidenceInput,version:2,reviewVersion:4,status:'disputed',attested:false,reason:'Synthetic concern reopened'});
    evidenceRows=await api(evidencePath+'?batchId='+imported.batchId,'owner');assert.equal(evidenceRows.rows[0].effectiveState,'disputed');assert.equal(evidenceRows.audit.length,4);assert.equal(JSON.parse(evidenceRows.audit[0].previousJson).status,'confirmed');
    await api(evidencePath,'student','POST',evidenceInput,403);await api(evidencePath,'owner','POST',evidenceInput,403,'https://other.example.test');await api(evidencePath,'owner','DELETE',{},405);
    assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 manual Admin evidence attestations, immutable snapshots, stale/reconfirmation/dispute lifecycle, audit and disabled posting/access');
    const linkPath='/api/admin/finance-payment-links';
    const linkInput={rowId:imported.batchId+':4',targetRowId:reviewInput.rowId,sourceReviewVersion:1,targetReviewVersion:4,version:0,status:'active',reason:'Save synthetic reviewed activation link'};
    const savedPaymentLink=await api(linkPath,'owner','POST',{...linkInput,snapshotJson:'FORGED',changedBy:'spoof'},201);assert.equal(savedPaymentLink.version,1);assert.equal(savedPaymentLink.canPost,false);await api(linkPath,'owner','POST',linkInput,409);
    let links=await api(linkPath+'?batchId='+imported.batchId,'owner');assert.equal(links.rows[1].effectiveState,'active');assert.equal(links.rows[1].link.changedBy,'synthetic-owner');assert.equal(JSON.parse(links.rows[1].link.snapshotJson).target.reviewVersion,4);assert.equal(links.audit.length,1);
    const savedPreview={...previewInput,useSavedLinks:true,links:[],linkVersions:[{rowId:linkInput.rowId,version:1}]};const usingSaved=await api(previewPath,'owner','POST',savedPreview);assert.equal(usingSaved.linkMode,'saved');assert.equal(usingSaved.rows[1].savedLinkState,'active');assert.equal(usingSaved.totals.activationGrossPaise,1500);assert.equal(usingSaved.canPost,false);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,version:4,reason:'Test saved target version binding'});
    links=await api(linkPath+'?batchId='+imported.batchId,'owner');assert.equal(links.rows[1].effectiveState,'stale');savedPreview.versions[0].version=5;const staleSaved=await api(previewPath,'owner','POST',savedPreview);assert.equal(staleSaved.rows[1].savedLinkState,'stale');assert.equal(staleSaved.totals.activationGrossPaise,0);
    await api(linkPath,'owner','POST',{...linkInput,version:1},409);await api(linkPath,'owner','POST',{...linkInput,version:1,targetReviewVersion:5,status:'revoked'});await api(previewPath,'owner','POST',savedPreview,409);
    savedPreview.linkVersions[0].version=2;assert.equal((await api(previewPath,'owner','POST',savedPreview)).rows[1].savedLinkState,'revoked');await api(linkPath,'owner','POST',{...linkInput,version:2,targetReviewVersion:5});
    const refundLink={rowId:reversalBatch.batchId+':2',targetRowId:reversalBatch.batchId+':1',sourceReviewVersion:1,targetReviewVersion:1,version:0,status:'active',reason:'Save synthetic refund relationship'};
    await api(linkPath,'owner','POST',refundLink,201);await api(linkPath,'owner','POST',{...refundLink,rowId:reversalBatch.batchId+':3'},409);const refundLinks=await api(linkPath+'?batchId='+reversalBatch.batchId,'owner');assert.equal(refundLinks.audit.length,1);assert.equal(refundLinks.rows[2].effectiveState,'not_linked');
    await api(linkPath,'student','POST',linkInput,403);await api(linkPath,'owner','POST',linkInput,403,'https://other.example.test');await api(linkPath,'owner','DELETE',{},405);assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 saved payment links, paired snapshots, stale/revoke/reactivate lifecycle, saved-preview versions, refund cap and unchanged access');
    const crossRows=[{...importRow,source:'appx',externalReference:'CROSS-RUNTIME-A',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000},{...importRow,externalReference:'CROSS-RUNTIME-R1',transactionKind:'refund',grossPaise:5000,feePaise:0,netPaise:5000},{...importRow,externalReference:'CROSS-RUNTIME-R2',transactionKind:'refund',grossPaise:2000,feePaise:0,netPaise:2000},{...importRow,source:'appx',externalReference:'CROSS-RUNTIME-A2',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000}];
    const crossBatch=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),sourceLabel:'Synthetic separate cross-batch export',data:JSON.stringify(crossRows)},201);
    for(const number of [1,2,3,4])await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:crossBatch.batchId+':'+number,reason:'Review synthetic separate export'},201);
    const crossLookupPath=linkPath+'?'+new URLSearchParams({action:'find-target',rowId:crossBatch.batchId+':1',source:'phonepe',reference:'REVERSAL-SALE'});const crossFound=await api(crossLookupPath,'owner');assert.equal(crossFound.target.rowId,reversalBatch.batchId+':1');assert.equal(crossFound.target.batchId,reversalBatch.batchId);await api(crossLookupPath,'student','GET',undefined,403);
    const crossLink={rowId:crossBatch.batchId+':1',targetRowId:reversalBatch.batchId+':1',sourceReviewVersion:1,targetReviewVersion:1,version:0,status:'active',reason:'Match earlier synthetic original payment'};
    await api(linkPath,'owner','POST',crossLink,201);await api(linkPath,'owner','POST',{...crossLink,rowId:crossBatch.batchId+':2'},201);await api(linkPath,'owner','POST',{...crossLink,rowId:crossBatch.batchId+':3'},409);await api(linkPath,'owner','POST',{...crossLink,rowId:crossBatch.batchId+':4',targetRowId:reviewInput.rowId,targetReviewVersion:5},409);
    const crossPreviewBody={batchId:crossBatch.batchId,versions:[1,2,3,4].map(number=>({rowId:crossBatch.batchId+':'+number,version:1})),links:[],useSavedLinks:true,linkVersions:[1,2,3,4].map(number=>({rowId:crossBatch.batchId+':'+number,version:number<=2?1:0}))};
    const crossPreview=await api(previewPath,'owner','POST',crossPreviewBody);assert.equal(crossPreview.blockedCount,2);assert.equal(crossPreview.contextTargets.length,1);assert.equal(crossPreview.contextTargets[0].receiptsCounted,false);assert.equal(crossPreview.totals.tuitionGrossPaise,-5000);assert.equal(crossPreview.totals.cashNetPaise,-4000);assert.equal(crossPreview.totalsScope,'selected_batch_movement');assert.equal(crossPreview.otherBatchReservations[0].refundPaise,4000);assert.equal(crossPreview.canPost,false);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:reversalBatch.batchId+':1',version:1,reason:'Invalidate cross-batch context review'});const crossStale=await api(linkPath+'?batchId='+crossBatch.batchId,'owner');assert.equal(crossStale.rows[0].effectiveState,'stale');assert.equal((await api(previewPath,'owner','POST',crossPreviewBody)).totals.cashNetPaise,0);assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 exact cross-batch target lookup, global activation/refund caps, prior receipts excluded, negative batch movement and external-review staleness');
    const approvalPath='/api/admin/finance-approvals';
    const approvalBatch=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),sourceLabel:'Synthetic approval-only export',data:JSON.stringify([{...importRow,externalReference:'APPROVAL-RUNTIME-T',grossPaise:10000,feePaise:0,netPaise:10000},{...importRow,source:'appx',externalReference:'APPROVAL-RUNTIME-A',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000}])},201);
    for(const number of [1,2])await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:approvalBatch.batchId+':'+number,reason:'Review synthetic approval source'},201);
    await api(linkPath,'owner','POST',{rowId:approvalBatch.batchId+':2',targetRowId:approvalBatch.batchId+':1',sourceReviewVersion:1,targetReviewVersion:1,version:0,status:'active',reason:'Bind synthetic approval relationship'},201);
    const blockedApproval=await api(approvalPath+'?batchId='+approvalBatch.batchId,'owner');assert.equal(blockedApproval.candidate.eligibleForReviewApproval,false);
    const heldBody={requestId:crypto.randomUUID(),batchId:approvalBatch.batchId,scopeHash:blockedApproval.candidate.scopeHash,decision:'held',attested:false,reason:'Synthetic evidence still pending'};await api(approvalPath,'owner','POST',{...heldBody,requestId:crypto.randomUUID(),decision:'review_approved',attested:true},400);await api(approvalPath,'owner','POST',heldBody,201);
    for(const number of [1,2])await api(evidencePath,'owner','POST',{...evidenceInput,rowId:approvalBatch.batchId+':'+number,reviewVersion:1,reason:'Confirm synthetic captured evidence'},201);
    const approvalCandidate=await api(approvalPath+'?batchId='+approvalBatch.batchId,'owner');assert(approvalCandidate.candidate.eligibleForReviewApproval);assert.equal(approvalCandidate.snapshots[0].effectiveState,'stale');assert.equal(approvalCandidate.candidate.preview.totals.cashNetPaise,11000);
    const approveBody={...heldBody,requestId:crypto.randomUUID(),scopeHash:approvalCandidate.candidate.scopeHash,decision:'review_approved',attested:true,reason:'Approve synthetic captured review only'};
    const approvedSnapshot=await api(approvalPath,'owner','POST',{...approveBody,actorId:'spoof',scopeJson:'FORGED'},201);assert.equal(approvedSnapshot.canPost,false);assert.equal(approvedSnapshot.verification,'unverified');assert((await api(approvalPath,'owner','POST',approveBody)).idempotentReplay);await api(approvalPath,'owner','POST',{...approveBody,reason:'Different input under same ID'},409);
    const capturedApproval=await api(approvalPath+'?snapshotId='+approvedSnapshot.id,'owner');assert.equal(capturedApproval.snapshot.actorId,'synthetic-owner');assert.equal(capturedApproval.snapshot.effectiveState,'review_approved');assert.equal(JSON.parse(capturedApproval.snapshot.scopeJson).rows.length,2);assert.equal(JSON.parse(capturedApproval.snapshot.previewJson).totals.cashNetPaise,11000);
    const approvalPeer=await api('/api/admin/finance-imports','owner','POST',{...importBody,requestId:crypto.randomUUID(),sourceLabel:'Synthetic external approval peer',data:JSON.stringify([{...importRow,externalReference:'APPROVAL-PEER-R',transactionKind:'refund',grossPaise:1000,feePaise:0,netPaise:1000}])},201);
    await api('/api/admin/finance-review','owner','POST',{...reviewInput,rowId:approvalPeer.batchId+':1',reason:'Review synthetic peer commitment'},201);await api(linkPath,'owner','POST',{rowId:approvalPeer.batchId+':1',targetRowId:approvalBatch.batchId+':1',sourceReviewVersion:1,targetReviewVersion:1,version:0,status:'active',reason:'Reserve synthetic external refund'},201);
    const staleApproval=await api(approvalPath+'?snapshotId='+approvedSnapshot.id,'owner');assert.equal(staleApproval.snapshot.effectiveState,'stale');assert.equal(staleApproval.snapshot.scopeJson,capturedApproval.snapshot.scopeJson);await api(approvalPath,'owner','POST',{...approveBody,requestId:crypto.randomUUID()},409);
    const approvalHistory=await api(approvalPath+'?batchId='+approvalBatch.batchId,'owner');assert.equal(approvalHistory.snapshots.length,2);assert.equal(approvalHistory.audit.length,2);assert.equal(approvalHistory.canPost,false);
    await api(approvalPath,'student','POST',approveBody,403);await api(approvalPath,'owner','POST',approveBody,403,'https://other.example.test');await api(approvalPath,'owner','DELETE',{},405);assert.deepEqual(await api('/api/enrolments','student'),beforeReviewAccess);
    console.log('PASS D1 immutable approval-review snapshots, hold/approve, server scope, idempotent replay, peer invalidation, retained audit and disabled posting/access');





    assert.equal((await api('/api/admin/learning','owner')).learnerCount,2);
    console.log('PASS D1 unverified JSON/CSV import staging, 200-row atomic bulk insert, duplicates/conflicts, idempotent retry and Admin-only audit review');
    assert(!logs.includes("Can't read from request stream after response has been sent"), 'Request stream lifecycle error');
  }
} catch (error) {
  console.error(logs.slice(-10000));
  throw error;
} finally {
  worker.kill('SIGTERM');
  const kill = setTimeout(() => worker.kill('SIGKILL'), 3000);
  kill.unref();
}
