'use strict';
let socialAdminLinks=[];
let publicSocialVersion=0;
function socialPublicMarkup(links){
 const platforms={youtube:'YouTube',whatsapp:'WhatsApp',telegram:'Telegram',instagram:'Instagram',facebook:'Facebook',website:'Website'};
 return links.flatMap(item=>{
  try{
   const url=new URL(item.url);
   if(url.protocol!=='https:'||url.username||url.password||!platforms[item.platform]||typeof item.label!=='string')return [];
   return [`<a class="button secondary" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer external" referrerpolicy="no-referrer" aria-label="${esc(item.label+' ('+platforms[item.platform]+', opens in a new tab)')}">${esc(platforms[item.platform])} · ${esc(item.label)}</a>`];
  }catch{return [];}
 }).join('');
}
async function loadPublicSocialLinks(){
 const target=document.getElementById('public-social-links');if(!target)return;
 const version=++publicSocialVersion;
 try{
  const response=await fetch('/api/social-links',{credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('Unavailable');
  const data=await response.json();if(version!==publicSocialVersion||!target.isConnected)return;
  const markup=socialPublicMarkup(Array.isArray(data.links)?data.links:[]);
  target.innerHTML=markup;target.hidden=!markup;
 }catch{if(version===publicSocialVersion&&target.isConnected){target.replaceChildren();target.hidden=true;}}
}
function socialAdminPanel(){return `<section class="panel admin-manager" style="margin-bottom:24px"><div class="section-head"><div><h2>Social links manager</h2><p class="small muted">Published links appear in the website footer for everyone. Use public destinations; keep paid-group invitations private.</p></div></div><div id="social-admin-list" aria-live="polite"><p>Loading saved links…</p></div><form id="social-link-form" class="panel" style="margin-top:16px"><h3>Add or update a link</h3><input type="hidden" name="id" value=""><label class="form-field">Platform<select name="platform" required><option value="youtube">YouTube</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="website">Website</option></select></label><label class="form-field">Display label<input name="label" maxlength="70" required placeholder="Official InspirED YouTube"></label><label class="form-field">Secure URL<input name="url" type="url" maxlength="500" required placeholder="https://…"></label><label class="form-field">Display order<input name="sortOrder" type="number" min="0" max="9999" value="100" required></label><label class="admin-checkbox-row"><input type="checkbox" name="enabled"> Publish this link publicly</label><div class="hero-actions"><button class="button" type="submit">Save social link</button><button type="button" class="button secondary" data-action="social-reset">Clear form</button></div><p id="social-admin-message" class="small muted" role="status"></p></form></section>`;}
function resetSocialForm(){const f=document.getElementById('social-link-form');if(f){f.reset();f.elements.id.value='';}}
async function loadSocialAdmin(){const list=document.getElementById('social-admin-list');if(!list)return;try{const r=await fetch('/api/admin/social-links',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Unable to load links. The database migration may not be applied.');const data=await r.json();socialAdminLinks=data.links||[];list.innerHTML=socialAdminLinks.length?socialAdminLinks.map(x=>`<div class="notice" style="margin:8px 0"><strong>${esc(x.label)}</strong> <small>(${esc(x.platform)} · ${x.enabled?(x.publiclyVisible?'Published':'Needs destination review'):'Hidden'})</small><p class="small muted">${esc(x.url)}</p><div class="hero-actions"><button class="button secondary" data-action="social-edit" data-id="${x.id}">Edit</button><button class="button secondary" data-action="social-toggle" data-id="${x.id}">${x.enabled?'Disable':'Enable'}</button><button class="button secondary" data-action="social-remove" data-id="${x.id}">Delete</button></div></div>`).join(''):'<p class="small muted">No official links added yet.</p>'; }catch(e){list.textContent=e.message;}}
function editSocialLink(id){const x=socialAdminLinks.find(x=>x.id===id),f=document.getElementById('social-link-form');if(!x||!f)return;for(const k of ['id','platform','label','url','sortOrder'])f.elements[k].value=x[k];f.elements.enabled.checked=x.enabled;f.scrollIntoView({behavior:'smooth',block:'start'});}
async function socialRequest(method,body){const r=await fetch('/api/admin/social-links',{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),data=await r.json();if(!r.ok)throw Error(data.error||'Update failed.');return data;}
async function saveSocialLink(f){return withAdminForm(f,async()=>{const m=document.getElementById('social-admin-message');const b={platform:f.elements.platform.value,label:f.elements.label.value.trim(),url:f.elements.url.value.trim(),sortOrder:Number(f.elements.sortOrder.value),enabled:f.elements.enabled.checked};if(f.elements.id.value)b.id=Number(f.elements.id.value);try{await socialRequest('POST',b);resetSocialForm();m.textContent='Saved successfully.';await loadSocialAdmin();await loadPublicSocialLinks();}catch(e){m.textContent=e.message;}});}
async function toggleSocialLink(id){const x=socialAdminLinks.find(x=>x.id===id);if(!x)return;try{await socialRequest('POST',x.enabled?{...x,enabled:false}:{...x,enabled:true});await loadSocialAdmin();await loadPublicSocialLinks();}catch(e){alert(e.message);}}
async function removeSocialLink(id){if(!confirm('Delete this social link?'))return;try{await socialRequest('DELETE',{id});await loadSocialAdmin();await loadPublicSocialLinks();}catch(e){alert(e.message);}}
