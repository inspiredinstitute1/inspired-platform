'use strict';
function financeAdminPanel(){return `<section class="panel admin-manager" style="margin-bottom:24px"><div class="section-head"><div><h2>Revenue &amp; Payment Reconciliation</h2><p class="small muted">Admin only · Preview without saving transactions</p></div></div><div class="notice info">This tool previews manually provided APPX, PhonePe, UPI and other transaction rows. Preview totals are not certified collections, verified tuition revenue, or profit. No financial data is saved.</div><form id="finance-preview-form"><label class="form-field">Paste JSON transaction rows (up to 200)<textarea name="transactions" rows="8" spellcheck="false" placeholder='[{"source":"phonepe","externalReference":"EXAMPLE-1","studentId":"student-id","courseCode":"HSTR","transactionKind":"tuition","grossPaise":99900,"feePaise":0,"netPaise":99900,"paidAt":"2026-10-19"}]' required></textarea></label><p class="small muted">Amounts are in paise. Only use authorized data; do not paste passwords or payment credentials. Nothing is uploaded until you select Preview.</p><div class="hero-actions"><button class="button" type="submit">Preview and validate</button><button class="button secondary" type="button" data-action="finance-clear">Clear</button></div></form><div id="finance-preview-results" aria-live="polite"></div></section>`;}
function financeMoney(paise){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format((paise||0)/100);}
let financePreviewController=null;
let financePreviewVersion=0;
function clearFinancePreview(){
 financePreviewVersion++;
 financePreviewController?.abort();financePreviewController=null;
 const form=document.getElementById('finance-preview-form');
 if(form){form.reset();form.removeAttribute('aria-busy');const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=false;}
 const el=document.getElementById('finance-preview-results');
 if(el){el.removeAttribute('aria-busy');el.replaceChildren();}
}
async function previewFinance(form){
 if(financePreviewController)return;
 const el=document.getElementById('finance-preview-results');if(!el)return;
 let transactions;
 try{transactions=JSON.parse(form.elements.transactions.value);if(!Array.isArray(transactions))throw Error('Paste a JSON array of transactions.');if(transactions.length>200)throw Error('Provide at most 200 transaction rows.');}
 catch(e){el.textContent=e.message;return;}
 const version=++financePreviewVersion,controller=new AbortController();financePreviewController=controller;
 const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
 form.setAttribute('aria-busy','true');el.setAttribute('aria-busy','true');el.textContent='Validating…';
 try{
  const response=await fetch('/api/admin/finance-preview',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({transactions}),signal:controller.signal});
  const data=await response.json();if(version!==financePreviewVersion)return;
  if(!response.ok)throw Error(data.error||'Preview failed.');
  el.innerHTML=`<div class="stats" style="margin-top:16px"><div class="stat"><div><small>Validated rows</small><b>${data.acceptedCount}</b></div></div><div class="stat"><div><small>Duplicates</small><b>${data.duplicates.length}</b></div></div><div class="stat"><div><small>Rejected</small><b>${data.rejected.length}</b></div></div><div class="stat"><div><small>Unlinked activations</small><b>${data.unlinkedActivationCount}</b></div></div></div><div class="notice"><strong>Unverified collection totals</strong><p>Gross: ${financeMoney(data.totals.grossPaise)} · Fees: ${financeMoney(data.totals.feePaise)} · Net: ${financeMoney(data.totals.netPaise)}</p><p class="small muted">${esc(data.note)}</p></div>${data.rejected.length?'<p class="small muted">Rejected row indices: '+data.rejected.map(x=>x.index+1).join(', ')+'</p>':''}`;
 }catch(e){if(version===financePreviewVersion&&e.name!=='AbortError')el.textContent=e.message;}
 finally{if(version===financePreviewVersion){financePreviewController=null;form.removeAttribute('aria-busy');el.removeAttribute('aria-busy');if(submit)submit.disabled=false;}}
}
