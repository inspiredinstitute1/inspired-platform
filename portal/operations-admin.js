let operationsLoad=0;
function operationsAdminPanel(){return '<section class="panel admin-manager" style="margin-bottom:24px"><h2>System readiness</h2><p class="small muted">Read-only schema and PDF-storage checks. These do not prove backups, gateway security, provider payments or release approval.</p><button type="button" class="button secondary" data-action="operations-reload">Run checks again</button><div id="operations-status" role="status" aria-live="polite">Loading checks…</div></section>';}
async function loadOperationsAdmin(){
 const el=document.getElementById('operations-status');if(!el)return;const generation=++operationsLoad;
 try{
  const response=await fetch('/api/admin/operations',{credentials:'same-origin',cache:'no-store'}),data=await response.json();
  if(generation!==operationsLoad||!el.isConnected)return;
  if(![200,503].includes(response.status)||data.scope!=='application-readiness-only')throw Error(data.error||'Readiness checks unavailable.');
  el.innerHTML=`<h3>${data.checksPassed?'Application checks passed':'Attention required'}</h3><p>${data.schema.migrationFiles} migration files expected · ${data.schema.expectedObjects} schema objects · PDF storage head ${data.pdfStorage.headReadable?'readable':'not verified'}.</p>${data.issues.map(issue=>`<p>${esc(issue.replaceAll('_',' '))}</p>`).join('')}${data.schema.missingObjects.length?`<details><summary>Missing schema objects (${data.schema.missingObjects.length})</summary>${data.schema.missingObjects.map(object=>`<p>${esc(object.type)} · ${esc(object.name)}</p>`).join('')}</details>`:''}<p class="small muted">No records changed. Hosted recovery, storage writes, authentication/gateway checks, quotas and release approval remain separate.</p>`;
 }catch(error){if(generation===operationsLoad&&el.isConnected)el.textContent=error.message;}
}
