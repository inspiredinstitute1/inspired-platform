// Aggregate only saved website attempts. No APPX/YouTube completion or syllabus inference.
export function learningReport(rows,tests,now=Date.now()){
 const since=now-7*86400000,topics=new Map(),allTests=new Set(),repeatByTopic=new Map();let withAttempts=0,active=0,recentAttempts=0,unsupported=0;
 for(const row of rows){
  let payload;try{payload=JSON.parse(row.payload);}catch{unsupported++;continue;}
  if(!payload||typeof payload!=='object'||!Array.isArray(payload.attempts||[])){unsupported++;continue;}
  const valid=[],ids=new Set();for(const attempt of payload.attempts||[]){if(!attempt||typeof attempt!=='object'){unsupported++;continue;}const test=tests.get(attempt.testId);if(!test||!Array.isArray(attempt.answers)||attempt.answers.length!==test.questions.length||attempt.answers.some(answer=>answer!==null&&(!Number.isInteger(answer)||answer<0||answer>3))||!Number.isSafeInteger(attempt.finishedAt)||attempt.finishedAt<0||attempt.finishedAt>now+300000||attempt.testRevision&&attempt.testRevision!==(test.revision||'sample-v1')){unsupported++;continue;}if(ids.has(attempt.id))continue;ids.add(attempt.id);valid.push(attempt);}
  if(valid.length)withAttempts++;if(valid.some(attempt=>attempt.finishedAt>=since&&attempt.finishedAt<=now))active++;
  recentAttempts+=valid.filter(attempt=>attempt.finishedAt>=since&&attempt.finishedAt<=now).length;
  const latest=new Map(),misses=new Map();for(const attempt of valid){const test=tests.get(attempt.testId),previous=latest.get(test.id);if(!previous||attempt.finishedAt>previous.finishedAt||attempt.finishedAt===previous.finishedAt&&String(attempt.id)>String(previous.id))latest.set(test.id,attempt);
   test.questions.forEach((question,index)=>{if(attempt.answers[index]===null||attempt.answers[index]===question.a)return;const key=JSON.stringify([test.id,test.revision||'sample-v1',index]),item=misses.get(key)||{count:0,topic:question.section||test.category};item.count++;misses.set(key,item);});}
  for(const item of misses.values())if(item.count>=2)repeatByTopic.set(item.topic,(repeatByTopic.get(item.topic)||0)+1);
  for(const attempt of latest.values()){const test=tests.get(attempt.testId);allTests.add(test.id);test.questions.forEach((question,index)=>{const name=question.section||test.category,item=topics.get(name)||{topic:name,correct:0,wrong:0,skipped:0};const answer=attempt.answers[index];if(answer===null)item.skipped++;else if(answer===question.a)item.correct++;else item.wrong++;topics.set(name,item);});}
 }
 const topicRows=[...topics.values()].map(topic=>({...topic,answered:topic.correct+topic.wrong,accuracy:topic.correct+topic.wrong?Math.round(topic.correct/(topic.correct+topic.wrong)*100):null,repeatedErrorItems:repeatByTopic.get(topic.topic)||0})).sort((a,b)=>(a.accuracy??101)-(b.accuracy??101)||a.topic.localeCompare(b.topic));
 return{learnerAccounts:rows.length,learnersWithAttempts:withAttempts,learnersWithoutAttempts:rows.length-withAttempts,activePracticeLearners7d:active,attempts7d:recentAttempts,availableTests:tests.size,attemptedTests:allTests.size,unsupportedAttempts:unsupported,topics:topicRows,basis:'Website saved attempts only. Accuracy uses the latest supported attempt per learner per test; repeated errors count learner/question pairs missed in at least two attempts. Seven days is a rolling 168-hour window. Test participation is not syllabus coverage.'};
}
