'use strict';
let materialSnapshot=[];
function materialAdminPanel(){return `<section class="panel admin-manager" style="margin-bottom:24px"><h2>Create study notes</h2><p class="small muted">Write free plain-text notes in English or Kannada. Create a draft first, then review and publish. Published notes are public to everyone, even without sign-in. Archive to remove them from future reads.</p><div id="material-list" aria-live="polite">Loading study notes…</div><form id="material-form"><input type="hidden" name="id"><input type="hidden" name="version"><label class="form-field">Title<input name="title" maxlength="120" required></label><label class="form-field">Category<input name="category" maxlength="60" required placeholder="Example: Grammar"></label><label class="form-field">Note content (plain text)<textarea name="body" rows="12" maxlength="20000" required></textarea></label><label class="form-field">Status<select name="status"><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published — public to everyone</option><option value="archived">Archived</option></select></label><p class="small muted">New notes must be saved as drafts. Saving a published note updates the public text. Select Draft or Review to withdraw it while editing. Copies already read or downloaded cannot be recalled.</p><label class="form-field">Reason for this change<input name="reason" minlength="3" maxlength="300" required></label><div class="hero-actions"><button class="button" type="submit">Save study note</button><button class="button secondary" type="button" data-action="material-reset">Clear form</button></div><p id="material-message" class="small muted" role="status"></p></form><details style="margin-top:20px"><summary>Recent study-note changes</summary><div id="material-audit"></div></details></section>`;}
function resetMaterialForm(){const form=document.getElementById('material-form');if(!form)return;form.reset();form.elements.id.value='';form.elements.version.value='';}
function editMaterial(id){const note=materialSnapshot.find(note=>note.id===id),form=document.getElementById('material-form');if(!note||!form)return;for(const key of ['id','version','title','category','body','status'])form.elements[key].value=note[key];form.elements.reason.value='';form.scrollIntoView({behavior:'smooth',block:'start'});}
async function loadMaterialAdmin(){
 const list=document.getElementById('material-list');if(!list)return;
 try{
  const response=await fetch('/api/admin/materials',{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'Study notes unavailable.');materialSnapshot=data.notes;
  list.innerHTML=data.notes.map(note=>`<div class="notice" style="margin:10px 0"><strong>${esc(note.title)}</strong><p class="small muted">${esc(note.category)} · ${esc(note.status)}</p><button class="button secondary" type="button" data-action="material-edit" data-id="${esc(note.id)}">Edit study note</button>${note.status==='published'?` <a class="button secondary" href="#/material/${esc(note.id)}">Read public note</a>`:''}</div>`).join('')||'<p>No authored study notes yet.</p>';
  const audit=document.getElementById('material-audit');if(audit)audit.innerHTML=data.audit.map(item=>`<div class="notice" style="margin:10px 0"><strong>${esc(item.title)}</strong><p class="small muted">${esc(item.status)} · ${esc(new Date(item.changedAt).toLocaleString())}</p><p>${esc(item.reason)}</p><small>Changed by ${esc(item.actorId)}</small></div>`).join('')||'<p>No note changes yet.</p>';
 }catch(error){list.textContent=error.message;}
}
async function saveMaterial(form){return withAdminForm(form,async()=>{
 const message=document.getElementById('material-message'),body={};for(const key of ['title','category','body','status','reason'])body[key]=form.elements[key].value;
 if(form.elements.id.value){body.id=form.elements.id.value;body.version=Number(form.elements.version.value);}
 try{
  const response=await fetch('/api/admin/materials',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(data.error||'Study note could not be saved.');
  form.elements.id.value=data.id;form.elements.version.value=data.version;form.elements.reason.value='';message.textContent=body.status==='published'?'Published. This note is public to everyone.':'Study note saved; it is not public.';await loadMaterialAdmin();await loadResourceAdmin();
 }catch(error){message.textContent=error.message;}
});}
function materialReaderPage(){return '<section id="authored-note-reader" class="panel" aria-live="polite"><p>Loading study note…</p></section>';}
async function loadPublishedMaterials(){
 const target=document.getElementById('published-study-notes');if(!target)return;
 try{
  const response=await fetch('/api/materials',{credentials:'omit',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error('Additional study notes are temporarily unavailable.');
  if(!target.isConnected)return;
  target.innerHTML=data.notes.length?'<h2>More free study notes</h2>'+data.notes.map(note=>`<div class="notice" style="margin:10px 0"><a class="text-link" href="#/material/${esc(note.id)}">${esc(note.title)}</a><p class="small muted">${esc(note.category)}</p></div>`).join(''):'';
 }catch(error){if(target.isConnected)target.textContent=error.message;}
}
async function loadMaterialReader(id){
 const target=document.getElementById('authored-note-reader');if(!target)return;
 try{
  const response=await fetch('/api/materials?id='+encodeURIComponent(id),{credentials:'omit',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(response.status===404?'This note is unavailable or has been withdrawn.':'Study note temporarily unavailable.');
  if(!target.isConnected)return;
  const note=data.note;target.innerHTML=`<a class="text-link" href="#/notes">← Free study notes</a><p class="eyebrow">${esc(note.category)}</p><h1>${esc(note.title)}</h1><div class="authored-note-text">${esc(note.body)}</div>`;
 }catch(error){if(target.isConnected)target.textContent=error.message;}
}
