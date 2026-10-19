'use strict';
const programmeKinds={division:'Division',course:'Course',subject:'Subject',module:'Module',test_series:'Test series',test:'Test'};
const programmeParents={division:[],course:['division'],subject:['course'],module:['subject'],test_series:['course','subject'],test:['module','test_series']};
let programmeSnapshot=[];
function contentAdminPanel(){return `<section class="panel admin-manager" style="margin-bottom:24px"><div class="section-head"><div><h2>Programme &amp; Module Manager</h2><p class="small muted">Organise divisions, courses, subjects, modules and tests. Only published records with published parents appear in Explore programmes. Existing notes and practice tests remain available.</p></div></div><div id="programme-list" aria-live="polite">Loading programmes…</div><form id="programme-form"><h3>Create or edit a programme</h3><input type="hidden" name="id"><input type="hidden" name="version"><div class="split-columns"><label class="form-field">Record type<select name="kind" id="programme-kind">${Object.entries(programmeKinds).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label class="form-field">Parent programme<select name="parentId" id="programme-parent"></select></label></div><label class="form-field">Title<input name="title" required maxlength="120"></label><label class="form-field">Description<textarea name="description" rows="3" maxlength="1000"></textarea></label><div class="split-columns"><label class="form-field">Status<select name="status"><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label><label class="form-field">Display order (lower numbers first)<input name="sortOrder" type="number" min="0" max="9999" value="100" required></label></div><label class="form-field">Reason for this change<input name="reason" minlength="3" maxlength="300" required placeholder="Example: Add the university English division"></label><p class="small muted">Archive to remove a programme from discovery while retaining its history. Publishing a programme listing does not create learning material or grant APPX access.</p><div class="hero-actions"><button class="button" type="submit">Save programme</button><button class="button secondary" type="button" data-action="programme-reset">Clear form</button></div><p id="programme-message" class="small muted" role="status"></p></form><details style="margin-top:20px"><summary>Recent programme changes</summary><div id="programme-audit"></div></details></section>`+resourceAdminPanel();}
function updateProgrammeParents(selected=''){
 const form=document.getElementById('programme-form');if(!form)return;
 const kind=form.elements.kind.value,allowed=programmeParents[kind]||[];
 const options=programmeSnapshot.filter(node=>allowed.includes(node.kind)&&node.id!==form.elements.id.value);
 const select=form.elements.parentId;
 select.innerHTML=kind==='division'?'<option value="">No parent — top-level division</option>':'<option value="">Choose a parent programme</option>'+options.map(node=>`<option value="${esc(node.id)}">${esc(node.title)} (${esc(node.status)})</option>`).join('');
 select.value=selected;select.required=kind!=='division';
}
function resetProgrammeForm(){const form=document.getElementById('programme-form');if(!form)return;form.reset();form.elements.id.value='';form.elements.version.value='';form.elements.kind.disabled=false;updateProgrammeParents();}
async function loadContentAdmin(){
 const list=document.getElementById('programme-list');if(!list)return;
 try{
  const response=await fetch('/api/admin/content',{credentials:'same-origin',cache:'no-store'}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Could not load programmes.');
  programmeSnapshot=data.nodes||[];
  list.innerHTML=programmeSnapshot.length?programmeSnapshot.map(node=>{const parent=programmeSnapshot.find(p=>p.id===node.parentId);return `<div class="notice" style="margin:10px 0"><strong>${esc(node.title)}</strong><p class="small muted">${esc(programmeKinds[node.kind])} · ${esc(node.status)} · Order ${node.sortOrder}${parent?' · Parent: '+esc(parent.title):''}</p><p>${esc(node.description)}</p><button class="button secondary" type="button" data-action="programme-edit" data-id="${esc(node.id)}">Edit programme</button></div>`;}).join(''):'<p>No programmes yet. Start by creating a division.</p>';
  const audit=document.getElementById('programme-audit');
  if(audit)audit.innerHTML=(data.audit||[]).map(entry=>{const next=JSON.parse(entry.nextJson),previous=entry.previousJson?JSON.parse(entry.previousJson):null;return `<div class="notice" style="margin:10px 0"><strong>${esc(next.title)}</strong><p class="small muted">${previous?esc(previous.status)+' → ':''}${esc(next.status)} · ${esc(new Date(entry.changedAt).toLocaleString())}</p><p>${esc(entry.reason)}</p><small>Changed by ${esc(entry.actorId)}</small></div>`;}).join('')||'<p>No changes recorded yet.</p>';
  updateProgrammeParents(document.getElementById('programme-form')?.elements.parentId.value||'');await loadResourceAdmin();
 }catch(error){list.textContent=error.message;}
}
function editProgramme(id){
 const node=programmeSnapshot.find(item=>item.id===id),form=document.getElementById('programme-form');if(!node||!form)return;
 for(const key of ['id','version','kind','title','description','status','sortOrder'])form.elements[key].value=node[key];
 form.elements.kind.disabled=true;form.elements.reason.value='';updateProgrammeParents(node.parentId||'');
 form.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveProgramme(form){return withAdminForm(form,async()=>{
 const message=document.getElementById('programme-message');
 const body={kind:form.elements.kind.value,parentId:form.elements.parentId.value||null,title:form.elements.title.value.trim(),description:form.elements.description.value.trim(),status:form.elements.status.value,sortOrder:Number(form.elements.sortOrder.value),reason:form.elements.reason.value.trim()};
 if(form.elements.id.value){body.id=form.elements.id.value;body.version=Number(form.elements.version.value);}
 try{
  const response=await fetch('/api/admin/content',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Programme could not be saved.');
  form.elements.id.value=data.id;form.elements.version.value=data.version;form.elements.reason.value='';
  message.textContent='Programme saved. Changes are recorded in the history.';await loadContentAdmin();
 }catch(error){message.textContent=error.message;}
 // Keep record type immutable after creating a record, including after the
 // shared form guard restores its original disabled states.
}).finally(()=>{if(form.elements.id.value)form.elements.kind.disabled=true;});}
async function loadProgrammeDiscovery(){
 const target=document.getElementById('programme-discovery');if(!target)return;
 try{
  const response=await fetch('/api/catalogue',{cache:'no-store'});if(!response.ok)return;
  const {programmes=[],resources=[]}=await response.json();if(!target.isConnected||!programmes.length)return;
  function branch(parentId){return programmes.filter(node=>node.parentId===parentId).map(node=>{const children=programmes.some(child=>child.parentId===node.id),materials=programmeResourceLinks(node.id,resources);const title=`<strong>${esc(node.title)}</strong> <span class="small muted">${esc(programmeKinds[node.kind])}</span>`;return children||materials?`<li><details><summary>${title}</summary><p>${esc(node.description)}</p>${materials}<ul>${branch(node.id)}</ul></details></li>`:`<li>${title}${node.description?'<p>'+esc(node.description)+'</p>':''}</li>`;}).join('');}
  target.innerHTML=`<h2>Explore programmes</h2><ul class="programme-tree">${branch(null)}</ul>`;target.hidden=false;
 }catch{/* Existing free learning remains available if the catalogue cannot load. */}
}
