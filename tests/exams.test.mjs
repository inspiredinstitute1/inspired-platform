import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {adminExamsEndpoint,examsEndpoint,parseExamCSV,validatePaper,paperImportReview} from '../lib/exam-service.mjs';
const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'},other={userId:'other',email:'other@example.test'};
const paper={title:'Synthetic grammar',durationMinutes:1,accessMode:'paid',questions:[{question:'Choose the noun.',options:['Book','Quickly','Very','And'],answer:1,explanation:'A book is a noun.'},{question:'Choose the verb.',options:['Run','Blue','Desk','And'],answer:1,explanation:'Run is a verb.'}],reason:'Synthetic development verification'};
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');const sql=readFileSync('docs/migrations/0021_paid_mock_exams.sql','utf8')+'\n'+readFileSync('docs/migrations/0022_complimentary_mock_codes.sql','utf8');db.exec(sql);const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap();}};const env={DB,PORTAL_ADMIN_EMAIL:owner.email};const req=(body,path='/api/exams',headers={})=>new Request('https://local.test'+path,{method:body?'POST':'GET',headers:{origin:'https://local.test','content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});const admin=(body,user=owner,path='/api/admin/exams')=>adminExamsEndpoint(req(body,path),user,env);const learner=(body,user=student,path='/api/exams')=>examsEndpoint(req(body,path),user,env);async function create(mode='paid'){const r=await admin({...paper,accessMode:mode,action:'import'});assert.equal(r.status,201,await r.clone().text());const p=await r.json();assert.equal((await admin({action:'status',examId:p.id,version:1,status:'published',reason:'Reviewed synthetic paper'})).status,200);return p.id;}async function code(id,email=student.email){const r=await admin({action:'issue-code',examId:id,email,validDays:1,paymentReference:'SYNTHETIC payment reference',paymentConfirmed:true});assert.equal(r.status,201,await r.clone().text());return(await r.json()).code;}async function unlocked(){const id=await create(),raw=await code(id);assert.equal((await learner({action:'redeem',code:raw})).status,200);return id;}return{db,sql,env,req,admin,learner,create,code,unlocked};}
const payload=async r=>{assert.equal(r.status,200,await r.clone().text());return r.json();};
test('paper validation supports quoted multilingual CSV and rejects malformed or unsafe structure',()=>{const rows=parseExamCSV('question,option1,option2,option3,option4,answer,solution\n"ಕನ್ನಡ, noun?",Book,Very,And,Quickly,1,"A noun.\nSecond line."');assert.equal(rows[0].question,'ಕನ್ನಡ, noun?');assert.match(rows[0].explanation,/Second line/);assert.throws(()=>parseExamCSV('"unclosed'),/Unclosed/);assert.throws(()=>parseExamCSV('question,question'),/Duplicate/);for(const change of [{durationMinutes:0},{questions:[]},{questions:[{...paper.questions[0],answer:0}]},{questions:[{...paper.questions[0],options:['A','A','B','C']}]},{format:'csv',content:null}])assert.throws(()=>validatePaper({...paper,...change}));});
test('admin authorization, same-origin writes and own account identity are enforced',async()=>{const h=setup();try{for(const user of [null,student])assert.equal((await h.admin({...paper,action:'import'},user)).status,403);assert.equal((await h.learner(undefined,null)).status,401);const req=h.req({...paper,action:'import'},'/api/admin/exams',{origin:'https://evil.test'});assert.equal((await adminExamsEndpoint(req,owner,h.env)).status,403);assert.equal((await examsEndpoint(h.req(undefined,'/api/exams',{'x-portal-account-id':'another'}),student,h.env)).status,409);}finally{h.db.close();}});
test('drafts stay hidden, paid papers stay locked and answer keys do not reach lists or active attempts',async()=>{const h=setup();try{await h.admin({...paper,action:'import'});assert.equal((await payload(await h.learner())).papers.length,0);const id=await h.create();const list=await payload(await h.learner());assert.equal(list.papers[0].unlocked,false);assert(!JSON.stringify(list).includes('Choose the noun'));assert.equal((await h.learner({action:'start',examId:id})).status,403);const code=await h.code(id);await payload(await h.learner({action:'redeem',code}));const a=await payload(await h.learner({action:'start',examId:id}));assert.equal(a.questions.length,2);assert(!('answer' in a.questions[0]));assert(!('explanation' in a.questions[0]));assert.equal(a.result,null);assert(!JSON.stringify(await payload(await h.admin())).includes(code));assert.equal(h.db.prepare('SELECT code_hash FROM exam_codes').get().code_hash.length,64);}finally{h.db.close();}});
test('codes require manual confirmation, bind email, reject replay and rate-limit guesses',async()=>{const h=setup();try{const id=await h.create();assert.equal((await h.admin({action:'issue-code',examId:id,email:student.email,validDays:1,paymentReference:'SYNTHETIC'})).status,400);const code=await h.code(id);assert.equal((await h.learner({action:'redeem',code},other)).status,403);assert.equal((await h.learner({action:'redeem',code})).status,200);assert.equal((await h.learner({action:'redeem',code})).status,403);for(let n=0;n<9;n++)await h.learner({action:'redeem',code:'invalid'},other);assert.equal((await h.learner({action:'redeem',code:'invalid'},other)).status,429);assert.equal(h.db.prepare('SELECT count(*) AS n FROM exam_grants').get().n,1);}finally{h.db.close();}});
test('resume keeps deadline, answers save with CAS, grading ignores forged score and final result is immutable',async()=>{const h=setup();try{const id=await h.unlocked();const a=await payload(await h.learner({action:'start',examId:id,deadline:Date.now()+99999999}));const resumed=await payload(await h.learner({action:'start',examId:id}));assert.equal(resumed.attempt.id,a.attempt.id);assert.equal(resumed.attempt.deadline,a.attempt.deadline);assert.equal(a.attempt.deadline-a.attempt.startedAt,60000);const save={action:'save',attemptId:a.attempt.id,version:1,answers:[1,null]};const saved=await payload(await h.learner(save));assert.equal(saved.attempt.version,2);assert.equal((await h.learner(save)).status,409);const result=await payload(await h.learner({...save,action:'submit',version:2,answers:[1,2],score:10000}));assert.equal(result.result.score,.75);assert.equal(result.questions[0].answer,1);const again=await payload(await h.learner({...save,action:'submit',version:3,answers:[1,1]}));assert.equal(again.result.score,.75);assert.throws(()=>h.db.exec("UPDATE exam_attempts SET answers_json='[1,1]'"),/final/);assert.equal((await h.learner(undefined,other,'/api/exams?attemptId='+a.attempt.id)).status,404);assert.equal((await h.learner({...save,action:'submit'},other)).status,404);}finally{h.db.close();}});
test('expired timer finalizes saved answers and ignores late supplied choices',async()=>{const h=setup();try{const id=await h.unlocked(),now=Date.now();h.db.prepare('INSERT INTO exam_attempts(id,exam_id,learner_id,started_at,deadline,answers_json) VALUES(?,?,?,?,?,?)').run('expired',id,student.userId,now-120000,now-60000,'[null,2]');const result=await payload(await h.learner({action:'submit',attemptId:'expired',version:1,answers:[1,1]}));assert.equal(result.result.score,-.25);assert.equal(result.result.skipped,1);assert.deepEqual(result.attempt.answers,[null,2]);assert.equal((await payload(await h.learner({action:'start',examId:id}))).attempt.id,'expired');}finally{h.db.close();}});
test('revoking or expiring codes and pausing papers block active reads and saves',async()=>{for(const mode of ['revoke','expire','pause']){const h=setup();try{const id=await h.unlocked(),a=await payload(await h.learner({action:'start',examId:id}));if(mode==='revoke'){const codeId=h.db.prepare('SELECT code_hash FROM exam_codes').get().code_hash;await payload(await h.admin({action:'revoke-code',examId:id,codeId}));}if(mode==='expire')h.db.exec('UPDATE exam_grants SET expires_at=1');if(mode==='pause')await payload(await h.admin({action:'status',examId:id,version:2,status:'paused',reason:'Pause synthetic exam'}));assert.equal((await h.learner({action:'save',attemptId:a.attempt.id,version:1,answers:[1,1]})).status,403);assert.equal((await h.learner(undefined,student,'/api/exams?attemptId='+a.attempt.id)).status,403);assert.equal(h.db.prepare('SELECT answers_json FROM exam_attempts').get().answers_json,'[null,null]');}finally{h.db.close();}}});
test('free timed papers need sign-in but no code; migration is repeatable and audit immutable',async()=>{const h=setup();try{const id=await h.create('free');assert.equal((await h.learner({action:'start',examId:id})).status,200);h.db.exec(h.sql);assert.equal(h.db.prepare('SELECT count(*) AS n FROM exam_attempts').get().n,1);assert.throws(()=>h.db.exec("UPDATE exam_attempts SET deadline=9999999999999"),/immutable/);assert.throws(()=>h.db.exec("UPDATE exam_papers SET questions_json='[]'"),/corrected edition/);assert.throws(()=>h.db.exec('DELETE FROM exam_audit'),/append only/);assert.equal(h.db.prepare("SELECT count(*) AS n FROM exam_audit WHERE kind='start'").get().n,1);}finally{h.db.close();}});

test('explicit CSV and JSON marks match +1 / -0.25; conflicting or blank marks are rejected',()=>{
 const csv='question,option1,option2,option3,option4,answer,solution,positive_marks,negative_marks\nChoose the noun.,Book,Very,And,Quickly,1,A noun.,1,0.25';
 const result=validatePaper({...paper,format:'csv',content:csv});assert.equal(result.questions[0].positiveMarks,1);assert.equal(result.questions[0].negativeMarks,.25);
 for(const values of ['1,-0.25','2,0.25','1,0','1,','1,abc'])assert.throws(()=>validatePaper({...paper,format:'csv',content:csv.replace('1,0.25',values)}),/requires positive marks/);
 assert.throws(()=>validatePaper({...paper,questions:[{...paper.questions[0],negativeMarks:1}]}),/requires positive marks/);
 assert.equal(validatePaper(paper).questions[0].negativeMarks,.25);
});

test('CSV rejects trailing text and illegal embedded quotes while preserving escaped quotes, BOM and CRLF',()=>{
 const header='question,option1,option2,option3,option4,answer,solution\r\n';
 for(const question of ['"Which?"junk','Which"bad','"Which?""'])assert.throws(()=>parseExamCSV(header+question+',A,B,C,D,1,Explanation'),/quote|Unclosed/);
 const parsed=parseExamCSV('\uFEFF'+header+'"A ""quoted"" question",A,B,C,D,1,"Line 1\r\nLine 2"\r\n');assert.equal(parsed[0].question,'A "quoted" question');assert.equal(parsed[0].explanation,'Line 1\r\nLine 2');
});
test('paper review warns about duplicate keys, missing labels and answer positions without changing content',()=>{
 const original=validatePaper({...paper,questions:[{...paper.questions[0],subject:'Grammar',topic:'Nouns'},{...paper.questions[0],answer:2},paper.questions[1]]});const before=JSON.stringify(original),r=paperImportReview(original);
 assert.equal(r.labelled,1);assert.equal(r.unlabelled,2);assert.deepEqual(r.answerPositions,[2,1,0,0]);assert.deepEqual(r.duplicatePairs,[{first:1,repeat:2,keyConflict:true}]);assert.equal(r.maximumMarks,3);assert.equal(r.topics[0].questions,1);assert.equal(JSON.stringify(original),before);
});
test('import preview reports review data without saving any paper',async()=>{const h=setup();try{const result=await payload(await h.admin({...paper,action:'preview'}));assert.equal(result.review.questionCount,2);assert.equal(result.review.unlabelled,2);assert.equal(h.db.prepare('SELECT count(*) AS n FROM exam_papers').get().n,0);assert.equal((await h.admin({...paper,action:'preview'},student)).status,403);}finally{h.db.close();}});

test('parallel starts and competing saves retain one attempt and one winning answer version',async()=>{const h=setup();try{
 const id=await h.unlocked(),starts=await Promise.all([h.learner({action:'start',examId:id}),h.learner({action:'start',examId:id})]);
 const [a,b]=await Promise.all(starts.map(payload));assert.equal(a.attempt.id,b.attempt.id);assert.equal(h.db.prepare('SELECT count(*) AS n FROM exam_attempts').get().n,1);
 const saves=await Promise.all([[1,null],[2,null]].map(answers=>h.learner({action:'save',attemptId:a.attempt.id,version:1,answers})));
 assert.deepEqual(saves.map(r=>r.status).sort(),[200,409]);const winner=await saves.find(r=>r.status===200).json();
 const refreshed=await payload(await h.learner(undefined,student,'/api/exams?attemptId='+a.attempt.id));assert.deepEqual(refreshed.attempt.answers,winner.attempt.answers);assert.equal(refreshed.attempt.version,2);assert.equal(refreshed.attempt.deadline,a.attempt.deadline);
 }finally{h.db.close();}});

test('revocation between initial access read and save is enforced by the final SQL guard',async()=>{const h=setup();try{
 const id=await h.unlocked(),a=await payload(await h.learner({action:'start',examId:id})),original=h.env.DB.prepare.bind(h.env.DB);let intercepted=false;
 h.env.DB.prepare=sql=>{const statement=original(sql);if(!sql.startsWith('UPDATE exam_attempts SET answers_json'))return statement;return{...statement,bind(...values){const bound=statement.bind(...values);return{...bound,async run(){intercepted=true;h.db.exec('UPDATE exam_codes SET revoked=1');return bound.run();}};}};};
 assert.equal((await h.learner({action:'save',attemptId:a.attempt.id,version:1,answers:[1,1]})).status,409);assert(intercepted);assert.equal(h.db.prepare('SELECT answers_json FROM exam_attempts').get().answers_json,'[null,null]');assert.equal(h.db.prepare('SELECT revoked FROM exam_grants').get().revoked,1);
 }finally{h.db.close();}});

test('database deadline rejects a save even when application clock is stale',async()=>{const h=setup(),realNow=Date.now;try{
 const id=await h.unlocked(),now=realNow();h.db.prepare('INSERT INTO exam_attempts(id,exam_id,learner_id,started_at,deadline,answers_json) VALUES(?,?,?,?,?,?)').run('stale-clock',id,student.userId,now-120000,now-60000,'[null,null]');
 Date.now=()=>now-90000;
 assert.equal((await h.learner({action:'save',attemptId:'stale-clock',version:1,answers:[1,1]})).status,409);assert.equal(h.db.prepare("SELECT answers_json FROM exam_attempts WHERE id='stale-clock'").get().answers_json,'[null,null]');
 Date.now=realNow;const final=await payload(await h.learner(undefined,student,'/api/exams?attemptId=stale-clock'));assert.equal(final.attempt.status,'submitted');assert.equal(final.result.score,0);assert.equal(final.result.skipped,2);
 }finally{Date.now=realNow;h.db.close();}});

test('complimentary issuance has no payment claim, hides raw code and enforces email, one use and revocation',async()=>{const h=setup();try{
 const id=await h.create();const r=await h.admin({action:'issue-code',examId:id,codeKind:'complimentary',email:' STUDENT@example.test ',validDays:1,complimentaryReason:'Scholarship'});assert.equal(r.status,201,await r.clone().text());const c=await r.json();assert.equal(c.codeKind,'complimentary');assert.match(c.note,/No payment claimed/);
 const stored=h.db.prepare('SELECT * FROM exam_codes').get();assert.equal(stored.payment_reference,'');assert.notEqual(stored.code_hash,c.code);
 assert.equal(h.db.prepare("SELECT count(*) n FROM exam_audit WHERE kind='issue-code'").get().n,0);
 assert.match(h.db.prepare("SELECT detail FROM exam_audit WHERE kind='issue-complimentary-code'").get().detail,/no payment claimed/);
 const list=await payload(await h.admin());assert.equal(list.codes[0].codeKind,'complimentary');assert.equal(list.codes[0].complimentaryReason,'Scholarship');assert(!JSON.stringify(list).includes(c.code));
 assert.equal((await h.learner({action:'redeem',code:c.code},other)).status,403);
 const redeem=await Promise.all([h.learner({action:'redeem',code:c.code}),h.learner({action:'redeem',code:c.code})]);assert.deepEqual(redeem.map(r=>r.status).sort(),[200,403]);
 const a=await payload(await h.learner({action:'start',examId:id}));
 await payload(await h.admin({action:'revoke-code',examId:id,codeId:stored.code_hash}));
 assert.equal((await h.learner({action:'save',attemptId:a.attempt.id,version:1,answers:[1,1]})).status,403);
 assert.equal(h.db.prepare('SELECT revoked FROM exam_grants').get().revoked,1);
 }finally{h.db.close();}});

test('complimentary validation rejects payment claims, invalid inputs and unauthorized issuers without records',async()=>{const h=setup();try{
 const id=await h.create(),b={action:'issue-code',examId:id,codeKind:'complimentary',email:student.email,validDays:1,complimentaryReason:'Test access'};
 for(const change of [{paymentConfirmed:true},{paymentReference:'Paid'},{complimentaryReason:''},{complimentaryReason:'x'.repeat(301)},{validDays:0},{validDays:366},{validDays:1.5},{email:'bad'},{codeKind:'unknown'}])assert.equal((await h.admin({...b,...change})).status,400);
 assert.equal((await h.admin(b,student)).status,403);assert.equal(h.db.prepare('SELECT count(*) n FROM exam_codes').get().n,0);
 const free=await h.create('free');assert.equal((await h.admin({...b,examId:free})).status,400);
 await payload(await h.admin({action:'status',examId:id,version:2,status:'paused',reason:'Test pause'}));assert.equal((await h.admin(b)).status,400);
 }finally{h.db.close();}});

test('complimentary expiry and pre-redemption revocation deny access; migration preserves paid codes',async()=>{const h=setup();try{
 const id=await h.create(),paid=await h.code(id);h.db.exec(h.sql);
 assert.equal((await h.learner({action:'redeem',code:paid})).status,200);
 for(const mode of ['expire','revoke']){
 const r=await h.admin({action:'issue-code',examId:id,codeKind:'complimentary',email:other.email,validDays:1,complimentaryReason:'Synthetic test'});assert.equal(r.status,201);const c=await r.json();
 const row=h.db.prepare('SELECT code_hash FROM exam_codes WHERE email=? AND used_by IS NULL AND revoked=0 AND expires_at>1').get(other.email);
 if(mode==='expire')h.db.prepare('UPDATE exam_codes SET expires_at=1 WHERE code_hash=?').run(row.code_hash);else await payload(await h.admin({action:'revoke-code',examId:id,codeId:row.code_hash}));
 assert.equal((await h.learner({action:'redeem',code:c.code},other)).status,403);
 }
 h.db.exec(h.sql);assert.equal(h.db.prepare('SELECT count(*) n FROM exam_complimentary_codes').get().n,2);
 assert.throws(()=>h.db.exec("UPDATE exam_complimentary_codes SET reason='changed'"),/immutable/);
 assert.equal(h.db.prepare("SELECT count(*) n FROM exam_audit WHERE kind='issue-code'").get().n,1);
 }finally{h.db.close();}});

test('complimentary issuance rolls back fully if its audit write fails',async()=>{const h=setup();try{
 const id=await h.create();h.db.exec("CREATE TRIGGER test_audit_failure BEFORE INSERT ON exam_audit WHEN NEW.kind='issue-complimentary-code' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
 assert.equal((await h.admin({action:'issue-code',examId:id,codeKind:'complimentary',email:student.email,validDays:1,complimentaryReason:'Test'})).status,503);
 for(const table of ['exam_codes','exam_complimentary_codes'])assert.equal(h.db.prepare('SELECT count(*) n FROM '+table).get().n,0);
 }finally{h.db.close();}});
