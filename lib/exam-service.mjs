import {roleFor} from './progress-service.mjs';
import {moduleGate} from './module-policy.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Cookie, oai-authenticated-user-id'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
export function parseExamCSV(source){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else fail('Invalid CSV quotes.');}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}else cell+=c;}
 if(quoted)fail('Unclosed CSV quote.');row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);
 const keys=(rows.shift()||[]).map(k=>k.trim().toLowerCase().replace(/^\uFEFF/,''));
 if(new Set(keys).size!==keys.length)fail('Duplicate CSV headers.');
 for(const k of ['question','option1','option2','option3','option4','answer','solution'])if(!keys.includes(k))fail('CSV needs question, option1, option2, option3, option4, answer, solution headers.');
 return rows.map(values=>{if(values.length!==keys.length)fail('CSV row has a different column count.');const r=Object.fromEntries(keys.map((k,i)=>[k,values[i]]));return{subject:r.subject||'',topic:r.topic||'',question:r.question,options:[r.option1,r.option2,r.option3,r.option4],answer:Number(r.answer),explanation:r.solution,passage:r.passage||'',positiveMarks:r.positive_marks===undefined?1:Number(r.positive_marks),negativeMarks:r.negative_marks===undefined?.25:Number(r.negative_marks)};});
}
export function validatePaper(input){
 if(!input||!text(input.title,160)||!Number.isInteger(input.durationMinutes)||input.durationMinutes<1||input.durationMinutes>240||!['paid','free'].includes(input.accessMode))fail('Add title, 1–240 minutes and paid/free access.');
 if(input.format==='csv'&&typeof input.content!=='string')fail('CSV text required.');
 const raw=input.format==='csv'?parseExamCSV(input.content):input.questions;
 if(!Array.isArray(raw)||raw.length<1||raw.length>250)fail('Import 1–250 questions.');
 const questions=raw.map((q,i)=>{if(q&&['subject','topic'].some(k=>q[k]!==undefined&&(typeof q[k]!=='string'||q[k].length>80)))fail('Subject and topic must be text up to 80 characters.');if(q&&((q.positiveMarks!==undefined&&q.positiveMarks!==1)||(q.negativeMarks!==undefined&&q.negativeMarks!==.25)))fail('Question '+(i+1)+': this edition requires positive marks 1 and negative marks 0.25 (deducted for a wrong answer).');if(!q||!text(q.question,5000)||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>!text(o,1500))||new Set(q.options.map(o=>o.trim())).size!==4||!Number.isInteger(q.answer)||q.answer<1||q.answer>4||!text(q.explanation,6000)||(q.passage!==undefined&&(typeof q.passage!=='string'||q.passage.length>15000)))fail('Check question '+(i+1)+': four distinct options, answer 1–4 and explanation required.');return{subject:(q.subject||'').trim(),topic:(q.topic||'').trim(),number:i+1,question:q.question.trim(),options:q.options.map(o=>o.trim()),answer:q.answer,explanation:q.explanation.trim(),passage:q.passage||'',positiveMarks:1,negativeMarks:.25};});
 return{title:input.title.trim(),durationMinutes:input.durationMinutes,accessMode:input.accessMode,questions};
}
async function bodyFor(request,max=1500000){
 if(request.headers.get('origin')!==new URL(request.url).origin)fail('Invalid request origin.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail('JSON required.',415);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>max)fail('Request too large.',413);
 try{const b=JSON.parse(raw);if(!b||Array.isArray(b)||typeof b!=='object')fail('Invalid request.');return b;}catch(e){if(e.status)throw e;fail('Invalid JSON.');}
}
const publicQuestions=p=>JSON.parse(p.questions_json).map(({number,question,options,passage})=>({number,question,options,passage}));
const paperInfo=p=>({id:p.id,title:p.title,durationMinutes:p.duration_minutes,accessMode:p.access_mode,status:p.status,questionCount:JSON.parse(p.questions_json).length,version:p.version});
const grantSQL="EXISTS(SELECT 1 FROM exam_grants g JOIN exam_codes c ON c.code_hash=g.code_hash WHERE g.exam_id=p.id AND g.learner_id=? AND g.revoked=0 AND c.revoked=0 AND g.expires_at>MAX(?,CAST(unixepoch('subsec')*1000 AS INTEGER)))";
async function accessible(DB,id,user,now){return DB.prepare(`SELECT p.* FROM exam_papers p WHERE p.id=? AND p.status='published' AND (p.access_mode='free' OR ${grantSQL})`).bind(id,user.userId,now).first();}
export function gradeExam(p,choices){const questions=JSON.parse(p.questions_json);let correct=0,wrong=0;questions.forEach((q,i)=>{if(choices[i]!==null){if(choices[i]===q.answer)correct++;else wrong++;}});return{correct,wrong,skipped:questions.length-correct-wrong,score:correct-wrong*.25,total:questions.length};}
function choicesFor(value,p){const count=JSON.parse(p.questions_json).length;if(!Array.isArray(value)||value.length!==count||value.some(v=>v!==null&&(!Number.isInteger(v)||v<1||v>4)))fail('Invalid answer selection.');return value;}
async function finish(DB,a,p){const result=gradeExam(p,JSON.parse(a.answers_json));await DB.prepare("UPDATE exam_attempts SET status='submitted',result_json=?,version=version+1 WHERE id=? AND status='active' AND version=?").bind(JSON.stringify(result),a.id,a.version).run();return DB.prepare('SELECT * FROM exam_attempts WHERE id=? AND learner_id=?').bind(a.id,a.learner_id).first();}
function attemptView(a,p,now){return{attempt:{id:a.id,examId:a.exam_id,status:a.status,startedAt:a.started_at,deadline:a.deadline,version:a.version,answers:JSON.parse(a.answers_json)},paper:paperInfo(p),questions:a.status==='submitted'?JSON.parse(p.questions_json):publicQuestions(p),result:a.status==='submitted'?JSON.parse(a.result_json):null,serverNow:now};}
export async function adminExamsEndpoint(request,user,env){
 try{
  if(!user?.userId||roleFor(user,env)!=='Admin')fail('Admin access required.',403);if(!env.DB)fail('Exam storage unavailable.',503);const DB=env.DB;
  if(request.method==='GET'){
   const id=new URL(request.url).searchParams.get('id');if(id){const p=await DB.prepare('SELECT * FROM exam_papers WHERE id=?').bind(id).first();if(!p)fail('Paper not found.',404);return json({paper:paperInfo(p),questions:JSON.parse(p.questions_json)});}
   const {results=[]}=await DB.prepare('SELECT * FROM exam_papers ORDER BY created_at DESC LIMIT 100').all();const codes=await DB.prepare('SELECT code_hash AS id,exam_id AS examId,email,expires_at AS expiresAt,revoked,used_by AS usedBy,payment_reference AS paymentReference FROM exam_codes ORDER BY created_at DESC LIMIT 100').all();const attempts=await DB.prepare('SELECT a.id,a.exam_id AS examId,a.learner_id AS learnerId,a.status,a.started_at AS startedAt,a.result_json AS result FROM exam_attempts a ORDER BY a.started_at DESC LIMIT 100').all();return json({papers:results.map(paperInfo),codes:codes.results||[],attempts:(attempts.results||[]).map(a=>({...a,result:a.result?JSON.parse(a.result):null}))});
  }
  if(request.method!=='POST')fail('Method not allowed.',405);const b=await bodyFor(request),now=Date.now();
  if(b.action==='preview'||b.action==='import'){const p=validatePaper(b);if(b.action==='preview')return json({paper:p,questionCount:p.questions.length});if(!text(b.reason,300))fail('Add an import reason.');const id=crypto.randomUUID();await DB.prepare('INSERT INTO exam_papers(id,title,duration_minutes,access_mode,questions_json,created_at,actor_id,reason) VALUES(?,?,?,?,?,?,?,?)').bind(id,p.title,p.durationMinutes,p.accessMode,JSON.stringify(p.questions),now,user.userId,b.reason.trim()).run();return json({id,status:'draft',version:1},201);}
  const p=await DB.prepare('SELECT * FROM exam_papers WHERE id=?').bind(b.examId||'').first();if(!p)fail('Paper not found.',404);
  if(b.action==='status'){if(!['draft','published','paused'].includes(b.status)||!Number.isSafeInteger(b.version)||!text(b.reason,300))fail('Add status, current version and reason.');const r=await DB.prepare('UPDATE exam_papers SET status=?,version=version+1,actor_id=?,reason=? WHERE id=? AND version=?').bind(b.status,user.userId,b.reason.trim(),p.id,b.version).run();if(!r.meta?.changes)fail('Paper changed. Reload.',409);return json({status:b.status,version:b.version+1});}
  if(b.action==='issue-code'){
   if(p.access_mode!=='paid'||p.status!=='published')fail('Publish a paid paper first.');if(!text(b.email,254)||!/^\S+@\S+\.\S+$/.test(b.email)||!text(b.paymentReference,200)||b.paymentConfirmed!==true||!Number.isInteger(b.validDays)||b.validDays<1||b.validDays>365)fail('Confirm your direct payment, learner email, reference and 1–365 access days.');
   const code=crypto.randomUUID().replaceAll('-','').toUpperCase(),digest=await hash(code),expiresAt=now+b.validDays*86400000;
   await DB.prepare('INSERT INTO exam_codes(code_hash,exam_id,email,expires_at,payment_reference,actor_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(digest,p.id,b.email.trim().toLowerCase(),expiresAt,b.paymentReference.trim(),user.userId,now).run();return json({code,expiresAt,note:'Shown once. Manual owner payment confirmation; no provider verification.'},201);
  }
  if(b.action==='revoke-code'){const r=await DB.prepare('UPDATE exam_codes SET revoked=1,actor_id=? WHERE code_hash=? AND exam_id=? AND revoked=0').bind(user.userId,b.codeId||'',p.id).run();if(!r.meta?.changes)fail('Active code not found.',404);return json({revoked:true});}
  fail('Unknown action.');
 }catch(e){return json({error:e.status?e.message:'Exam manager unavailable. Existing records retained.'},e.status||503);}
}
export async function examsEndpoint(request,user,env){
 try{
  if(!user?.userId||!user?.email)fail('Sign in with your own account to use mock exams.',401);if(!env.DB)fail('Exam storage unavailable.',503);const DB=env.DB,paused=await moduleGate(env,'practice');if(paused)return paused;
  const expected=request.headers.get('x-portal-account-id');if(expected&&expected!==encodeURIComponent(user.userId))fail('Your account changed. Refresh.',409);
  const now=Date.now(),params=new URL(request.url).searchParams;
  if(request.method==='GET'){
   if(params.has('attemptId')){let a=await DB.prepare('SELECT * FROM exam_attempts WHERE id=? AND learner_id=?').bind(params.get('attemptId'),user.userId).first();if(!a)fail('Attempt not found.',404);const p=await DB.prepare('SELECT * FROM exam_papers WHERE id=?').bind(a.exam_id).first();if(a.status==='active'){if(!await accessible(DB,p.id,user,now))fail('Exam access is unavailable or expired.',403);if(a.deadline<=now)a=await finish(DB,a,p);}return json(attemptView(a,p,now));}
   const {results=[]}=await DB.prepare(`SELECT p.*,CASE WHEN p.access_mode='free' OR ${grantSQL} THEN 1 ELSE 0 END AS unlocked FROM exam_papers p WHERE p.status='published' ORDER BY created_at DESC LIMIT 100`).bind(user.userId,now).all();const attempts=await DB.prepare('SELECT id,exam_id AS examId,status FROM exam_attempts WHERE learner_id=? ORDER BY started_at DESC LIMIT 100').bind(user.userId).all();return json({papers:results.map(p=>({...paperInfo(p),unlocked:!!p.unlocked})),attempts:attempts.results||[],serverNow:now});
  }
  if(request.method!=='POST')fail('Method not allowed.',405);const b=await bodyFor(request,20000);
  if(b.action==='redeem'){
   const window=Math.floor(now/3600000),limit=await DB.prepare('INSERT INTO exam_code_limits(learner_id,window,tries) VALUES(?,?,1) ON CONFLICT(learner_id,window) DO UPDATE SET tries=tries+1 RETURNING tries').bind(user.userId,window).first();if(limit.tries>10)fail('Too many code attempts. Try again next hour.',429);
   if(typeof b.code!=='string'||! /^[A-F0-9]{32}$/.test(b.code.trim().toUpperCase()))fail('Code is invalid, expired or belongs to a different email.',403);
   const digest=await hash(b.code.trim().toUpperCase());const used=await DB.prepare("UPDATE exam_codes SET used_by=?,used_at=? WHERE code_hash=? AND email=? AND revoked=0 AND used_by IS NULL AND expires_at>MAX(?,CAST(unixepoch('subsec')*1000 AS INTEGER)) AND EXISTS(SELECT 1 FROM exam_papers p WHERE p.id=exam_codes.exam_id AND p.status='published') RETURNING exam_id").bind(user.userId,now,digest,user.email.toLowerCase(),now).first();if(!used)fail('Code is invalid, expired, already redeemed or belongs to a different email.',403);return json({redeemed:true,examId:used.exam_id});
  }
  if(b.action==='start'){
   const p=await accessible(DB,b.examId||'',user,now);if(!p)fail('Redeem a valid access code before starting this exam.',403);const id=crypto.randomUUID(),answers=JSON.stringify(JSON.parse(p.questions_json).map(()=>null));
   await DB.prepare(`INSERT OR IGNORE INTO exam_attempts(id,exam_id,learner_id,started_at,deadline,answers_json) SELECT ?,p.id,?,?,?,? FROM exam_papers p WHERE p.id=? AND p.status='published' AND (p.access_mode='free' OR ${grantSQL})`).bind(id,user.userId,now,now+p.duration_minutes*60000,answers,p.id,user.userId,now).run();let a=await DB.prepare('SELECT * FROM exam_attempts WHERE exam_id=? AND learner_id=?').bind(p.id,user.userId).first();if(!a)fail('Access changed. Reload.',409);if(a.status==='active'&&a.deadline<=now)a=await finish(DB,a,p);return json(attemptView(a,p,now));
  }
  let a=await DB.prepare('SELECT * FROM exam_attempts WHERE id=? AND learner_id=?').bind(b.attemptId||'',user.userId).first();if(!a)fail('Attempt not found.',404);const p=await DB.prepare('SELECT * FROM exam_papers WHERE id=?').bind(a.exam_id).first();if(a.status==='submitted')return json(attemptView(a,p,now));if(!await accessible(DB,p.id,user,now))fail('Exam access is unavailable or expired.',403);
  if(a.deadline<=now){a=await finish(DB,a,p);return json(attemptView(a,p,now));}
  if(!['save','submit'].includes(b.action)||!Number.isSafeInteger(b.version))fail('Invalid attempt action.');const choices=choicesFor(b.answers,p),result=b.action==='submit'?JSON.stringify(gradeExam(p,choices)):null;
  const r=await DB.prepare(`UPDATE exam_attempts SET answers_json=?,result_json=?,status=?,version=version+1 WHERE id=? AND learner_id=? AND version=? AND status='active' AND deadline>MAX(?,CAST(unixepoch('subsec')*1000 AS INTEGER)) AND EXISTS(SELECT 1 FROM exam_papers p WHERE p.id=exam_attempts.exam_id AND p.status='published' AND (p.access_mode='free' OR ${grantSQL}))`).bind(JSON.stringify(choices),result,b.action==='submit'?'submitted':'active',a.id,user.userId,b.version,now,user.userId,now).run();if(!r.meta?.changes)fail('A newer attempt save exists or access changed. Reload this attempt.',409);a=await DB.prepare('SELECT * FROM exam_attempts WHERE id=? AND learner_id=?').bind(a.id,user.userId).first();return json(attemptView(a,p,now));
 }catch(e){return json({error:e.status?e.message:'Mock exam unavailable. Retry without starting a new account.'},e.status||503);}
}
