import {learningReport} from './learning-report.mjs';
import {dynamicNoteId,progressNoteSelection} from './library-service.mjs';
import bank from './portal-catalogue.json' with {type:'json'};
const tests=new Map(bank.tests.map(t=>[t.id,t]));
const noteIds=new Set(bank.notes),videoIds=new Set(bank.videos);
const EXAMS=['HSTR & GPSTR','HSTR','GPSTR','Other competitive exams'];
export const emptyProgress=()=>({profile:null,read:[],saved:[],watched:[],attempts:[],drafts:{},activity:{},goal:5,customNotes:[]});
export function roleFor(user,env){return user?.email&&env.PORTAL_ADMIN_EMAIL&&user.email.toLowerCase()===env.PORTAL_ADMIN_EMAIL.toLowerCase()?'Admin':'Student';}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function boundedText(x,n){if(typeof x!=='string'||x.length>n)fail('Invalid text field.');return x;}
function timestamp(x){if(!Number.isSafeInteger(x)||x<0||x>Date.now()+300000)fail('Invalid activity date.');return x;}
function answers(x,n){if(!Array.isArray(x)||x.length!==n||x.some(v=>v!==null&&(!Number.isInteger(v)||v<0||v>3)))fail('Invalid question answers.');return x.slice();}
function testFor(id){const t=tests.get(id);if(!t)fail('Unknown practice test.');return t;}
export function normaliseProgress(input,role,additionalNoteIds=[]){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid progress.');
 const out=emptyProgress();
 if(input.profile!==null&&input.profile!==undefined){const p=input.profile;const name=boundedText(p.name,45).trim();if(!name||!EXAMS.includes(p.exam))fail('Check your display name and exam.');out.profile={name,exam:p.exam};}
 if(!Array.isArray(input.customNotes||[])||(input.customNotes||[]).length>50)fail('Too many preview notes.');
 if((input.customNotes||[]).length&&role!=='Admin')fail('Only Admin can create preview notes.',403);
 out.customNotes=(input.customNotes||[]).map(n=>{if(!/^preview-note-\d{10,15}$/.test(n.id))fail('Invalid preview note.');return{id:n.id,title:boundedText(n.title,80),category:['Grammar','Literature','Pedagogy','Vocabulary'].includes(n.category)?n.category:'Grammar',minutes:Math.min(120,Math.max(1,Number(n.minutes)||1)),description:'A review note added in the private Admin workspace.',letter:'N',body:boundedText(n.body,100000)};});
 const validNotes=new Set([...noteIds,...additionalNoteIds,...out.customNotes.map(n=>n.id)]);
 function ids(value,valid){if(!Array.isArray(value||[])||(value||[]).length>1000)fail('Invalid saved resources.');if((value||[]).some(x=>typeof x!=='string'||!valid.has(x)))fail('Unknown learning resource.');return[...new Set(value||[])];}
 out.read=ids(input.read,validNotes);out.saved=ids(input.saved,validNotes);out.watched=ids(input.watched,videoIds);
 if(!Array.isArray(input.attempts||[])||(input.attempts||[]).length>1000)fail('Invalid practice history.');
 const attemptIds=new Set();
 out.attempts=(input.attempts||[]).map(a=>{const t=testFor(a.testId);const id=boundedText(a.id,100);if(!/^[a-zA-Z0-9_-]+$/.test(id)||attemptIds.has(id))fail('Invalid or duplicate attempt.');attemptIds.add(id);const revision=t.revision||'sample-v1';if(a.testRevision&&a.testRevision!==revision)fail('This attempt uses an unsupported test edition.');const choices=answers(a.answers,t.questions.length);let correct=0,wrong=0;choices.forEach((x,i)=>{if(x!==null)x===t.questions[i].a?correct++:wrong++;});return{id,testId:t.id,title:t.title,testRevision:revision,questionNumbers:t.questions.map((q,i)=>q.number||i+1),total:t.questions.length,answers:choices,correct,wrong,skipped:t.questions.length-correct-wrong,score:correct-wrong*.25,finishedAt:timestamp(a.finishedAt)};});
 out.attempts.sort((a,b)=>a.finishedAt-b.finishedAt);
 if(input.drafts&&(!Object.prototype.isPrototypeOf.call(Object.prototype,input.drafts)||Array.isArray(input.drafts)))fail('Invalid unfinished practice.');
 for(const [id,d] of Object.entries(input.drafts||{})){const t=testFor(id),revision=t.revision||'sample-v1';if(d.revision&&d.revision!==revision)fail('Please restart this updated practice edition.');const flags=[...new Set(d.flags||[])];if(flags.some(x=>!Number.isInteger(x)||x<0||x>=t.questions.length)||!Number.isInteger(d.index)||d.index<0||d.index>=t.questions.length)fail('Invalid question navigator.');const draft={answers:answers(d.answers,t.questions.length),flags,startedAt:timestamp(d.startedAt),index:d.index,revision};if(!out.attempts.some(a=>a.testId===id&&a.finishedAt>=draft.startedAt))out.drafts[id]=draft;}
 if(![3,4,5,6,7].includes(input.goal??5))fail('Invalid weekly goal.');out.goal=input.goal??5;
 if(Object.keys(input.activity||{}).length>1500)fail('Invalid learning activity.');
 for(const[k,v]of Object.entries(input.activity||{})){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!Number.isSafeInteger(v)||v<0||v>10000)fail('Invalid learning activity.');out.activity[k]=v;}
 return out;
}
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers});}
function authorise(user){if(!user?.userId||!user?.email)fail('Sign in to your account.',401);}
function protectWrite(request){const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)fail('This save must come from your portal.',403);if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use a JSON request.',415);}
async function rowFor(DB,userId){return await DB.prepare('SELECT payload, version, updated_at FROM learner_progress WHERE user_id = ?').bind(userId).first();}
function current(row){return row?{payload:JSON.parse(row.payload),version:row.version,updatedAt:row.updated_at}:{payload:emptyProgress(),version:0,updatedAt:null};}
function identity(user,env){return{id:user.userId,email:user.email,displayName:user.displayName||user.email,role:roleFor(user,env)};}
export async function progressEndpoint(request,user,env){
 try{
  authorise(user);
  const expected=request.headers.get('x-portal-account-id');
  // A stale tab must not read/merge or write its state into a replacement session.
  // This precondition binds the tab; authentication still comes only from user.
  if(expected!==null&&expected!==encodeURIComponent(user.userId))return json({error:'Your signed-in account changed. Refresh before syncing.',code:'ACCOUNT_CHANGED'},409);
  if(request.method==='PUT'&&expected===null)return json({error:'Refresh the portal before saving progress.',code:'ACCOUNT_REQUIRED'},428);
  if(!env.DB)fail('Account saving is temporarily unavailable.',503);
  if(request.method==='GET')return json({...current(await rowFor(env.DB,user.userId)),user:identity(user,env)});
  if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
  protectWrite(request);if(Number(request.headers.get('content-length')||0)>2000000)fail('Progress is too large to save.',413);
  const text=await request.text();if(text.length>2000000)fail('Progress is too large to save.',413);
  let body;try{body=JSON.parse(text);}catch{fail('Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail('Invalid save request.');
  if(!Number.isSafeInteger(body.version)||body.version<0)fail('Invalid save version.');
  const hasDynamic=[body.payload?.read,body.payload?.saved].some(list=>Array.isArray(list)&&list.some(dynamicNoteId));
  const previous=hasDynamic?current(await rowFor(env.DB,user.userId)).payload:null;
  const selection=await progressNoteSelection(env.DB,body.payload,previous),omitted=new Set(selection.omitted);
  const input=selection.omitted.length?{...body.payload,read:(body.payload.read||[]).filter(id=>!omitted.has(id)),saved:(body.payload.saved||[]).filter(id=>!omitted.has(id))}:body.payload;
  const payload=normaliseProgress(input,roleFor(user,env),selection.allowed),now=Date.now();
  let result;
  if(body.version===0){result=await env.DB.prepare('INSERT OR IGNORE INTO learner_progress (user_id,email,display_name,role,payload,version,updated_at) VALUES (?,?,?,?,?,1,?) RETURNING version').bind(user.userId,user.email,user.displayName||user.email,roleFor(user,env),JSON.stringify(payload),now).first();}
  else{result=await env.DB.prepare('UPDATE learner_progress SET email = ?, display_name = ?, role = ?, payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ? RETURNING version').bind(user.email,user.displayName||user.email,roleFor(user,env),JSON.stringify(payload),now,user.userId,body.version).first();}
  if(!result)return json({error:'A newer save is available.',user:identity(user,env),...current(await rowFor(env.DB,user.userId))},409);
  return json({payload,version:result.version,updatedAt:now,user:identity(user,env),unavailableResources:selection.omitted});
 }catch(e){if(/Practice is paused/.test(e.message))return json({error:'Practice is paused. Existing history is retained; new test changes remain on your device.'},503);return json({error:e.status?e.message:'Account saving is temporarily unavailable. Your device copy is retained.'},e.status||503);}
}
export async function adminEndpoint(request,user,env){
 try{
  authorise(user);if(roleFor(user,env)!=='Admin')fail('Admin access is required.',403);if(!env.DB)fail('Learning analytics are temporarily unavailable.',503);
  const {results=[]}=await env.DB.prepare('SELECT user_id, email, display_name, role, payload, updated_at FROM learner_progress ORDER BY display_name').all();
  const rows=results.filter(r=>roleFor({email:r.email},env)!=='Admin');
  const topics=new Map();let totalAttempts=0;
  const learners=rows.map(r=>{const p=JSON.parse(r.payload);totalAttempts+=p.attempts.length;const latest=new Map();p.attempts.forEach(a=>latest.set(a.testId,a));for(const a of latest.values()){const t=tests.get(a.testId);if(!t)continue;t.questions.forEach((q,i)=>{const topic=q.section||t.category;const s=topics.get(topic)||{topic,correct:0,wrong:0,skipped:0};if(a.answers[i]===null)s.skipped++;else if(a.answers[i]===q.a)s.correct++;else s.wrong++;topics.set(topic,s);});}const last=p.attempts.at(-1);return{name:p.profile?.name||r.display_name,notes:p.read.length,classes:p.watched.length,attempts:p.attempts.length,last:last?{title:last.title,score:last.score,total:last.total,finishedAt:last.finishedAt}:null};});
  return json({report:learningReport(rows,tests),learnerCount:learners.length,totalAttempts,learners,topics:[...topics.values()].map(s=>({...s,accuracy:s.correct+s.wrong?Math.round(s.correct/(s.correct+s.wrong)*100):null})),basis:'Latest attempt per student per test. Admin practice is excluded.'});
 }catch(e){return json({error:e.status?e.message:'Learning analytics are temporarily unavailable.'},e.status||503);}
}
