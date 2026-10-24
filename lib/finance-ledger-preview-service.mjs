import {roleFor} from './progress-service.mjs';
import {normaliseLedgerRow,crossBatchContext,ledgerEvidence} from './finance-cross-batch-context.mjs';
import {loadPaymentLinks} from './finance-payment-links-service.mjs';
import {previewLedger} from './finance-ledger-policy.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const id=value=>typeof value==='string'&&value.length>0&&value.length<=200;
export async function financeLedgerPreviewEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(request.method==='GET')return json({previewOnly:true,canPost:false,note:'POST a saved batch ID, all accepted row versions and optional activation/refund links. Nothing is saved.'});
 if(request.method!=='POST')return json({error:'Preview only; no ledger changes are supported.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 if(!env.DB)return json({error:'Ledger preview unavailable.'},503);
 try{
  const raw=await request.text();if(new TextEncoder().encode(raw).length>100000)return json({error:'Preview too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||typeof body.batchId!=='string'||!/^[a-f0-9-]{36}$/.test(body.batchId)||!Array.isArray(body.versions)||body.versions.length>200||!body.versions.every(row=>row&&id(row.rowId)&&Number.isSafeInteger(row.version)&&row.version>=0)||!Array.isArray(body.links)||body.links.length>200||!body.links.every(row=>row&&id(row.rowId)&&id(row.targetRowId)))return json({error:'Provide a saved batch, row versions and valid matching links.'},400);
  if(body.useSavedLinks!==undefined&&typeof body.useSavedLinks!=='boolean')return json({error:'Choose temporary or saved links.'},400);
  if(body.useSavedLinks&&(body.links.length||!Array.isArray(body.linkVersions)||body.linkVersions.length>200||!body.linkVersions.every(row=>row&&id(row.rowId)&&Number.isSafeInteger(row.version)&&row.version>=0)))return json({error:'Saved mode requires complete saved-link versions and no temporary links.'},400);
  const batch=await env.DB.prepare('SELECT id FROM finance_import_batches WHERE id=?').bind(body.batchId).first();if(!batch)return json({error:'Import batch not found.'},404);
  const saved=await env.DB.prepare(`SELECT f.id AS rowId,f.transaction_json AS transactionJson,r.learner_id AS learnerId,r.node_id AS nodeId,r.status,r.evidence_reference AS evidenceReference,COALESCE(r.version,0) AS version,p.email AS learnerEmail,p.user_id AS savedLearner,n.kind AS programmeKind,e.status AS evidenceStatus,e.review_version AS evidenceReviewVersion,e.version AS evidenceDecisionVersion FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id LEFT JOIN finance_evidence_decisions e ON e.row_id=f.id WHERE f.batch_id=? AND f.verdict='accepted' ORDER BY f.row_number`).bind(body.batchId).all();
  const rows=saved.results||[];if(!rows.length)return json({error:'This batch has no accepted rows to preview.'},400);
  const versions=new Map(body.versions.map(row=>[row.rowId,row.version]));
  if(versions.size!==body.versions.length||versions.size!==rows.length||rows.some(row=>versions.get(row.rowId)!==row.version))return json({error:'Reviews changed or the selected rows are incomplete. Reload the batch before previewing.'},409);
  rows.forEach(row=>normaliseLedgerRow(row,env));
  let links=body.links,savedLinkRows=[];
  if(body.useSavedLinks){
   savedLinkRows=await loadPaymentLinks(env.DB,body.batchId,env);
   if(savedLinkRows.length!==rows.length||savedLinkRows.some(row=>rows.find(saved=>saved.rowId===row.rowId)?.version!==row.reviewVersion))return json({error:'Reviews changed while loading saved links. Reload before previewing.'},409);
   const dependent=savedLinkRows.filter(row=>['activation','refund'].includes(JSON.parse(row.transactionJson).transactionKind)),expected=new Map(body.linkVersions.map(row=>[row.rowId,row.version]));
   if(expected.size!==body.linkVersions.length||expected.size!==dependent.length||dependent.some(row=>expected.get(row.rowId)!==(row.link?.version||0)))return json({error:'Saved payment links changed or versions are incomplete. Reload links before previewing.'},409);
   links=dependent.filter(row=>row.effectiveState==='active').map(row=>({rowId:row.rowId,targetRowId:row.link.targetRowId}));
  }
  const context=await crossBatchContext(env.DB,rows,body.useSavedLinks?links:links.filter(link=>rows.some(row=>row.rowId===link.targetRowId)),env);
  if(body.useSavedLinks&&links.some(link=>{const current=[...rows,...context.contextRows].find(row=>row.rowId===link.targetRowId),stored=savedLinkRows.find(row=>row.rowId===link.rowId)?.link;return!current||current.version!==stored.targetReviewVersion;}))return json({error:'A linked original payment review changed. Reload saved links before previewing.'},409);
  const references=JSON.stringify([...rows,...context.contextRows].map(row=>({source:row.transaction.source,externalReference:row.transaction.externalReference})));
  const existing=await env.DB.prepare("SELECT source,external_reference AS externalReference FROM finance_transactions f WHERE EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.source')=f.source AND json_extract(j.value,'$.externalReference')=f.external_reference)").bind(references).all();
  let result;try{result=previewLedger(rows,links,existing.results||[],context);}catch(error){return json({error:error.message},400);}
  const decisions=new Map(rows.map(row=>[row.rowId,ledgerEvidence(row)]));
  result.rows=result.rows.map(row=>({...row,...decisions.get(row.rowId)}));
  result.manualEvidenceComplete=[...rows,...context.contextRows].every(row=>ledgerEvidence(row).evidenceState==='confirmed');
  result.totalsScope='selected_batch_movement';
  result.note+=' Amounts are selected-batch movements; earlier context receipts are excluded. These are not lifetime revenue totals.';
  result.contextTargets=context.contextRows.map(row=>({rowId:row.rowId,batchId:row.batchId,version:row.version,reference:row.transaction.externalReference,...ledgerEvidence(row),receiptsCounted:false}));
  result.otherBatchReservations=context.reservations.map(reservation=>({...reservation,reference:[...rows,...context.contextRows].find(row=>row.rowId===reservation.targetRowId)?.transaction.externalReference||reservation.targetRowId}));
  if(!result.manualEvidenceComplete)result.approvalBlockers.push('current_admin_evidence_confirmation_required');
  result.linkMode=body.useSavedLinks?'saved':'temporary';
  if(body.useSavedLinks)result.rows=result.rows.map(row=>({...row,savedLinkState:savedLinkRows.find(saved=>saved.rowId===row.rowId)?.effectiveState||'not_linked',savedLinkVersion:savedLinkRows.find(saved=>saved.rowId===row.rowId)?.link?.version||0}));
  return json({batchId:body.batchId,...result});
 }catch{return json({error:'Ledger preview unavailable. No records were changed.'},503);}
}
