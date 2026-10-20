import {roleFor} from './progress-service.mjs';
const percent=(a,b)=>b?Math.round(a/b*1000)/10:null;
const empty=()=>({correct:0,wrong:0,skipped:0});
function metrics(v){const attempted=v.correct+v.wrong,questions=attempted+v.skipped;return {...v,questions,attempted,accuracy:percent(v.correct,attempted),coverage:percent(attempted,questions),score:v.correct-.25*v.wrong,negativeLoss:.25*v.wrong,lostMarks:1.25*v.wrong+v.skipped};}
export function analyseExams(rows){
 const overall=empty(),topics=new Map(),items=new Map(),history=[];let excluded=0,unlabelled=0;
 for(const row of rows){let qs,answers;try{qs=JSON.parse(row.questions_json);answers=JSON.parse(row.answers_json);}catch{excluded++;continue;}
  if(!Array.isArray(qs)||!qs.length||!Array.isArray(answers)||answers.length!==qs.length||qs.some(q=>!q||!Number.isInteger(q.answer)||q.answer<1||q.answer>4)||answers.some(a=>a!==null&&(!Number.isInteger(a)||a<1||a>4))){excluded++;continue;}
  const totals=empty();qs.forEach((q,i)=>{const subject=typeof q.subject==='string'?q.subject.trim():'',topic=typeof q.topic==='string'?q.topic.trim():'';if(!subject||!topic)unlabelled++;const key=JSON.stringify([subject,topic]);if(!topics.has(key))topics.set(key,{...empty(),subject:subject||'Unlabelled subject',topic:topic||'Unlabelled topic',labelled:!!(subject&&topic),learners:new Set(),papers:new Set()});const t=topics.get(key);t.learners.add(row.learner_id);t.papers.add(row.exam_id);
   const ik=JSON.stringify([row.exam_id,i]);if(!items.has(ik))items.set(ik,{...empty(),paper:row.title,number:i+1});const outcome=answers[i]===null?'skipped':answers[i]===q.answer?'correct':'wrong';overall[outcome]++;totals[outcome]++;t[outcome]++;items.get(ik)[outcome]++;
  });history.push({title:row.title,startedAt:row.started_at,...metrics(totals)});
 }
 const topicRows=[...topics.values()].map(({learners,papers,...v})=>({...metrics(v),learnerCount:learners.size,paperCount:papers.size,evidence:v.correct+v.wrong+v.skipped>=5?'usable':'limited'})).sort((a,b)=>b.lostMarks-a.lostMarks);
 const focus=topicRows.filter(t=>t.labelled&&t.lostMarks>0).slice(0,3).map(t=>({...t,action:t.skipped>t.wrong?'Review this concept, then attempt 10 fresh topic questions.':'Review wrong-answer explanations, write the rule, then attempt 10 fresh topic questions.'}));
 const reliable=topicRows.filter(t=>t.labelled&&t.evidence==='usable');
 const describe=t=>`${t.subject} / ${t.topic}: ${t.accuracy??'—'}% accuracy, ${t.coverage}% attempted (${t.questions} responses).`;
 return {overall:metrics(overall),attemptCount:history.length,excluded,unlabelled,topics:topicRows,history:history.sort((a,b)=>a.startedAt-b.startedAt),focus,swot:{strengths:reliable.filter(t=>t.accuracy>=80&&t.coverage>=70).map(describe),weaknesses:reliable.filter(t=>t.accuracy!==null&&t.accuracy<60).map(describe),opportunities:focus.map(t=>`${t.subject} / ${t.topic}: ${t.action}`),threats:[...(overall.wrong?[`${.25*overall.wrong} marks deducted for wrong answers.`]:[]),...(overall.skipped?[`${overall.skipped} questions left unanswered.`]:[]),...(unlabelled?[`${unlabelled} responses lack full topic labels; focus analysis is incomplete.`]:[])]},questionReview:[...items.values()].map(metrics).filter(t=>t.questions>=5&&(t.wrong+t.skipped)/t.questions>=.5).slice(0,100)};
}
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
export async function examAnalyticsEndpoint(request,user,env){
 if(!user?.userId)return json({error:'Sign in to view your analytics.'},401);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 const expected=request.headers.get('x-portal-account-id');if(expected&&expected!==encodeURIComponent(user.userId))return json({error:'Your account changed. Refresh.'},409);
 const admin=roleFor(user,env)==='Admin',target=new URL(request.url).searchParams.get('learnerId');if(!admin&&target&&target!==user.userId)return json({error:'You can view only your own analytics.'},403);
 try{
  const args=[],where=["a.status='submitted'"];
  if(!admin||target){where.push('a.learner_id=?');args.push(admin?target:user.userId);}
  if(admin){where.push("a.learner_id<>? AND NOT EXISTS(SELECT 1 FROM learner_progress l WHERE l.user_id=a.learner_id AND (l.role='Admin' OR lower(l.email)=lower(?)))");args.push(user.userId,env.PORTAL_ADMIN_EMAIL||'');}
  const {results=[]}=await env.DB.prepare(`SELECT a.exam_id,a.learner_id,a.started_at,a.answers_json,p.title,(SELECT json_group_array(json_object('answer',json_extract(j.value,'$.answer'),'subject',json_extract(j.value,'$.subject'),'topic',json_extract(j.value,'$.topic'))) FROM json_each(p.questions_json) j) AS questions_json FROM exam_attempts a JOIN exam_papers p ON p.id=a.exam_id WHERE ${where.join(' AND ')} ORDER BY a.started_at DESC,a.id DESC LIMIT 201`).bind(...args).all();
  const rows=results.slice(0,200),report=analyseExams(rows);if(!admin)delete report.questionReview;
  return json({...report,scope:admin?(target?'learner':'cohort'):'self',limited:results.length>200,...(admin?{learners:[...new Set(rows.map(r=>r.learner_id))].map(id=>{const report=analyseExams(rows.filter(r=>r.learner_id===id));return{id,attemptCount:report.attemptCount,score:report.overall.score};})}:{})});
 }catch{return json({error:'Analytics unavailable. Please retry. No records were changed.'},503);}
}
