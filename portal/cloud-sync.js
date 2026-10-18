function isAdmin(){return cloud.user?.role==='Admin';}
function snapshot(value=state){return JSON.parse(JSON.stringify(value));}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function mergeCloud(base,local,remote){
 const b=Object.assign(defaults(),base||{}),l=Object.assign(defaults(),local||{}),r=Object.assign(defaults(),remote||{}),out=Object.assign(defaults(),r);
 function mergeSet(bv,lv,rv){const bs=new Set(bv||[]),ls=new Set(lv||[]),rs=new Set(rv||[]);for(const x of new Set([...bs,...ls]))if(ls.has(x)!==bs.has(x)){if(ls.has(x))rs.add(x);else rs.delete(x);}return [...rs];}
 for(const k of ['read','saved','watched'])out[k]=mergeSet(b[k],l[k],r[k]);
 for(const k of ['profile','goal'])out[k]=same(l[k],b[k])?r[k]:l[k];
 out.customNotes=[...new Map([...l.customNotes,...r.customNotes].map(n=>[n.id,n])).values()];
 out.attempts=[...new Map([...l.attempts,...r.attempts].map(a=>[a.id,a])).values()].sort((a,b)=>a.finishedAt-b.finishedAt);
 out.activity={...r.activity};for(const[k,n]of Object.entries(l.activity))out.activity[k]=Math.max(0,(r.activity[k]||0)+n-(b.activity[k]||0));
 out.drafts={};
 for(const id of new Set([...Object.keys(r.drafts),...Object.keys(l.drafts)])){
  const ld=l.drafts[id],rd=r.drafts[id],bd=b.drafts[id];let d;
  if(!ld)d=rd;
  else if(!rd)d=ld;
  else if(ld.startedAt!==rd.startedAt)d=ld.startedAt>rd.startedAt?ld:rd;
  else{d={...rd,answers:rd.answers.map((v,i)=>ld.answers[i]!==bd?.answers[i]?ld.answers[i]:v),flags:mergeSet(bd?.flags,ld.flags,rd.flags),index:ld.index!==bd?.index?ld.index:rd.index};}
  if(d&&!out.attempts.some(a=>a.testId===id&&a.finishedAt>=d.startedAt))out.drafts[id]=d;
 }
 return out;
}
function persistAccount(){try{localStorage.setItem(STORE,JSON.stringify(cloud.user?{payload:state,base:cloud.base,version:cloud.version,pending:cloud.pending}:state));}catch(e){storageOK=false;}}
function cloudMessage(){if(!cloud.user)return 'Progress saved on this device';if(cloud.saving)return 'Saving your progress…';if(cloud.error)return 'Not synced yet · your device copy is retained';if(cloud.pending)return 'Changes waiting to save';return 'Saved to your account';}
function updateCloudStatus(){const el=$('#cloud-status');if(!el)return;el.className='cloud-status '+(cloud.error?'sync-error':cloud.pending||cloud.saving?'sync-pending':'sync-saved');el.innerHTML=`<span>${icon(cloud.error?'flag':'check')}${esc(cloudMessage())}</span>${!cloud.user?'<a class="text-link" href="#/account">Sign in & save</a>':''}${cloud.error&&cloud.user?'<button type="button" class="text-link" data-action="sync-now">Try again</button>':''}`;}
function progressNotice(){return `<div class="notice info">${esc(cloudMessage())}. ${cloud.user?'Your notes, bookmarks, completed classes and test history follow this account across devices.':'Sign in to keep your scores, bookmarks and unfinished practice across devices.'} APPX and YouTube progress remain separate.</div>`;}
function queueCloudSave(){if(!cloud.user)return;cloud.pending=true;cloud.error=false;persistAccount();updateCloudStatus();clearTimeout(cloud.timer);cloud.timer=setTimeout(()=>syncProgress(),650);}
async function accountFetch(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{return await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});}finally{clearTimeout(timer);}}
async function syncProgress(pull=false){
 if(!cloud.user||cloud.saving)return;
 cloud.saving=true;updateCloudStatus();
 try{
  // Reconcile the remote version first after an offline start or an explicit refresh.
  if(pull||!cloud.loaded){const r=await accountFetch('/api/progress');if(!r.ok)throw new Error('Account unavailable');const remote=await r.json();state=mergeCloud(cloud.base,state,remote.payload);cloud.base=remote.payload;cloud.version=remote.version;cloud.loaded=true;cloud.pending=!same(state,cloud.base);}
  for(let retry=0;cloud.pending&&retry<4;retry++){
   const sent=snapshot(),r=await accountFetch('/api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:cloud.version,payload:sent})}),remote=await r.json();
   if(r.status===409){state=mergeCloud(cloud.base,state,remote.payload);cloud.base=remote.payload;cloud.version=remote.version;persistAccount();continue;}
   if(!r.ok)throw new Error(remote.error||'Save unavailable');
   state=mergeCloud(sent,state,remote.payload);cloud.base=remote.payload;cloud.version=remote.version;cloud.pending=!same(state,remote.payload);cloud.error=false;persistAccount();
  }
  if(cloud.pending)throw new Error('Another device is saving. Please retry.');
  cloud.error=false;persistAccount();
 }catch(e){cloud.error=true;persistAccount();}
 finally{cloud.saving=false;updateCloudStatus();}
}
function initCloud(){
 updateCloudStatus();
 if(!cloud.user)return;
 window.addEventListener('online',()=>syncProgress(true));
 window.addEventListener('focus',async()=>{const routeBefore=route();await syncProgress(true);if(route()===routeBefore&&!$('#profile-form')&&!$('#admin-note-form'))render(true);});
 if(cloud.pending||!cloud.loaded)cloud.timer=setTimeout(()=>syncProgress(),800);
}
async function loadAdminLearning(){
 const el=$('#admin-learning');if(!el||!isAdmin())return;
 try{const r=await accountFetch('/api/admin/learning');if(!r.ok)throw new Error('Unavailable');const d=await r.json();if(!$('#admin-learning'))return;el.innerHTML=`<h2>Student learning insights</h2><p class="small muted" style="margin:12px 0">${d.learnerCount} student accounts · ${d.totalAttempts} saved attempts. ${esc(d.basis)}</p>${d.learnerCount?`<div class="table-wrap"><table class="history-table"><thead><tr><th>STUDENT</th><th>NOTES</th><th>CLASSES</th><th>ATTEMPTS</th><th>LATEST PRACTICE</th></tr></thead><tbody>${d.learners.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.notes}</td><td>${s.classes}</td><td>${s.attempts}</td><td>${s.last?esc(s.last.title)+' · '+s.last.score+' / '+s.last.total:'No attempt yet'}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:22px">Topics to revisit</h3><p class="small muted" style="margin:10px 0">Accuracy counts answered questions; skipped questions are shown separately. All attempts remain in student history.</p><div class="table-wrap"><table class="history-table"><thead><tr><th>TOPIC</th><th>CORRECT</th><th>WRONG</th><th>SKIPPED</th><th>ACCURACY</th></tr></thead><tbody>${d.topics.sort((a,b)=>(a.accuracy??101)-(b.accuracy??101)).map(t=>`<tr><td>${esc(t.topic)}</td><td>${t.correct}</td><td>${t.wrong}</td><td>${t.skipped}</td><td>${t.accuracy===null?'—':t.accuracy+'%'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Student insights will appear after authorised students begin saving their learning. Your Admin practice is excluded.</p>'}`;}catch(e){if($('#admin-learning'))el.innerHTML='<h2>Student learning insights</h2><p class="small muted" style="margin:12px 0">Insights could not load. Refresh this page to try again. Your learning history is retained.</p>';}
}
function accessRequired(){return intro('Admin access required','This workspace is available only to the institute Admin.')+link('home','Return to learning');}

function signedOutAccountPage(){const returnTo='/?import=guest#/account',signIn='/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo);return intro('Student Portal','Your learning journey starts here. Access courses, tests and progress tracking.','YOUR PERSONAL LEARNING SPACE')+`<section class="panel account-card"><div class="account-tabs"><span class="chip active">Create Student Account</span><span class="chip">Student</span></div><h2>Take your progress with you.</h2><p>Free notes, tests and video classes are open to everyone. Sign in with your ChatGPT account to keep your scores, bookmarks and unfinished tests across devices.</p><ul class="checklist"><li>${icon('check')}Resume your practice on another device</li><li>${icon('check')}Keep your answer reviews and test history</li><li>${icon('check')}Bring this browser’s free practice into your account</li></ul><div class="hero-actions"><a class="button" href="${esc(signIn)}" target="_top">Create My Account ${icon('arrow')}</a>${link('notes','Continue with free notes','button secondary')}</div><p class="small muted" style="margin-top:18px">Already have an account? The same button signs you in. Premium course access remains in the InspirED Android app.</p></section>`;}
