'use strict';
let pdfSnapshot=[];
function fileAdminPanel(){return `<section class="panel admin-manager" style="margin-bottom:24px"><h2>Upload study PDFs</h2><p class="small muted">Upload a PDF up to 5 MiB as a private draft. Download and review the file before publishing. Published PDFs are free to everyone; archiving blocks future downloads through this website.</p><form id="pdf-upload-form"><label class="form-field">PDF file<input name="file" type="file" accept="application/pdf,.pdf" required></label><label class="form-field">Title<input name="title" maxlength="120" required></label><label class="form-field">Category<input name="category" maxlength="60" required></label><label class="form-field">Reason for uploading<input name="reason" minlength="3" maxlength="300" required></label><button class="button" type="submit">Upload private draft</button><p id="pdf-upload-message" class="small muted" role="status"></p></form><div id="pdf-file-list" aria-live="polite">Loading PDFs…</div><form id="pdf-metadata-form" hidden><input type="hidden" name="id"><input type="hidden" name="version"><label class="form-field">Title<input name="title" maxlength="120" required></label><label class="form-field">Category<input name="category" maxlength="60" required></label><label class="form-field">Status<select name="status"><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published — public to everyone</option><option value="archived">Archived</option></select></label><label class="form-field">Reason for this change<input name="reason" minlength="3" maxlength="300" required></label><p class="small muted">File bytes cannot be replaced in place. Upload a new draft for a corrected PDF. Previously downloaded copies cannot be recalled.</p><button class="button" type="submit">Save PDF details</button><p id="pdf-metadata-message" class="small muted" role="status"></p></form><details style="margin-top:20px"><summary>Recent PDF changes</summary><div id="pdf-audit"></div></details></section>`;}
async function loadFileAdmin(){
 const list=document.getElementById('pdf-file-list');if(!list)return;
 try{
  const response=await fetch('/api/admin/files',{credentials:'same-origin',cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'PDF manager unavailable.');if(!list.isConnected)return;pdfSnapshot=data.files;
  list.innerHTML=(data.storageAvailable?'':'<p>PDF storage is unavailable. Uploads and downloads are paused.</p>')+data.files.map(file=>`<div class="notice" style="margin:12px 0"><strong>${esc(file.title)}</strong><p>${esc(file.category)} · ${esc(file.status)} · ${(file.bytes/1024).toFixed(1)} KiB</p><p class="small muted">${esc(file.fileName)}</p><div class="hero-actions"><a class="button secondary" href="/api/admin/files/download?id=${esc(file.id)}">Download for review</a><button class="button secondary" type="button" data-action="pdf-edit" data-id="${esc(file.id)}">Edit PDF details</button></div></div>`).join('')+(data.files.length?'':'<p>No PDFs uploaded yet.</p>');
  const audit=document.getElementById('pdf-audit');if(audit)audit.innerHTML=data.audit.map(item=>`<div class="notice"><strong>${esc(item.title)} · ${esc(item.status)}</strong><p>${esc(item.reason)}</p><small>${esc(item.actorId)} · ${esc(new Date(item.changedAt).toLocaleString())}</small></div>`).join('')||'<p>No PDF changes yet.</p>';
 }catch(error){if(list.isConnected)list.textContent=error.message;}
}
async function uploadStudyPdf(form){return withAdminForm(form,async()=>{
 const message=document.getElementById('pdf-upload-message'),file=form.elements.file.files[0];
 if(!file||file.size<32||file.size>5*1024*1024){message.textContent='Choose a PDF from 32 bytes to 5 MiB.';return;}
 // Controls are disabled while pending, so append explicitly rather than letting
 // FormData(form) silently omit all disabled fields, including the file.
 const body=new FormData();body.append('file',file);for(const key of ['title','category','reason'])body.append(key,form.elements[key].value);
 try{
  const response=await fetch('/api/admin/files',{method:'POST',credentials:'same-origin',body}),data=await response.json();if(!response.ok)throw Error(data.error||'PDF upload failed.');
  form.reset();message.textContent='PDF saved as a private draft. Review it before publishing.';await loadFileAdmin();await loadResourceAdmin();
 }catch(error){message.textContent=error.message;}
});}
function editPdf(id){const file=pdfSnapshot.find(item=>item.id===id),form=document.getElementById('pdf-metadata-form');if(!file||!form)return;form.hidden=false;for(const key of ['id','version','title','category','status'])form.elements[key].value=file[key];form.elements.reason.value='';form.scrollIntoView({behavior:'smooth',block:'start'});}
async function savePdfMetadata(form){return withAdminForm(form,async()=>{
 const message=document.getElementById('pdf-metadata-message'),body={version:Number(form.elements.version.value)};for(const key of ['id','title','category','status','reason'])body[key]=form.elements[key].value;
 try{
  const response=await fetch('/api/admin/files',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(data.error||'PDF details could not be saved.');
  form.elements.version.value=data.version;form.elements.reason.value='';message.textContent=body.status==='published'?'Published. This PDF is free to everyone.':'Saved. This PDF is not publicly downloadable.';await loadFileAdmin();await loadResourceAdmin();
 }catch(error){message.textContent=error.message;}
});}
