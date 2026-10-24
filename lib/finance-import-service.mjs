import {roleFor} from './progress-service.mjs';
import {parseImportData,normaliseImportRow,canonicalSnapshot} from './finance-import-parser.mjs';
const headers={'content-type':'application/json','cache-control':'private, no-store','vary':'Cookie, oai-authenticated-user-id','x-content-type-options':'nosniff'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>=3&&value.length<=max;
const batchFields='id,source_label AS sourceLabel,imported_by AS importedBy,reason,total_rows AS totalRows,accepted_rows AS acceptedRows,duplicate_rows AS duplicateRows,rejected_rows AS rejectedRows,created_at AS createdAt';
const summary=row=>({batchId:row.id,acceptedRows:row.acceptedRows,duplicateRows:row.duplicateRows,rejectedRows:row.rejectedRows,totalRows:row.totalRows,verification:'unverified'});
export async function financeImportsEndpoint(request,user,env){
 if(!user?.userId||roleFor(user,env)!=='Admin')return json({error:'Admin access required.'},403);
 if(!env.DB)return json({error:'Payment import review unavailable.'},503);
 try{
  if(request.method==='GET'){
   const batches=await env.DB.prepare(`SELECT ${batchFields} FROM finance_import_batches ORDER BY created_at DESC,id LIMIT 20`).all();
   const id=new URL(request.url).searchParams.get('batchId')??batches.results?.[0]?.id;
   if(id!==undefined&&!uuid(id))return json({error:'Invalid import batch.'},400);
   const selected=id?await env.DB.prepare(`SELECT ${batchFields} FROM finance_import_batches WHERE id=?`).bind(id).first():null;if(id&&!selected)return json({error:'Import batch not found.'},404);
   const rows=id?await env.DB.prepare('SELECT row_number AS rowNumber,verdict,transaction_json AS transactionJson,raw_json AS rawJson,flags_json AS flagsJson,issue FROM finance_import_rows WHERE batch_id=? ORDER BY row_number').bind(id).all():{results:[]};
   const audit=await env.DB.prepare('SELECT batch_id AS batchId,actor_id AS actorId,reason,changed_at AS changedAt FROM finance_import_audit ORDER BY id DESC LIMIT 50').all();
   return json({batches:batches.results||[],selected,rows:rows.results||[],audit:audit.results||[],verification:'unverified',stagingOnly:true});
  }
  if(request.method!=='POST')return json({error:'Import records and history are retained for review.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid request origin.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>100000)return json({error:'Import request too large.'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
  if(!body||Array.isArray(body)||!uuid(body.requestId)||!text(body.sourceLabel,120)||!text(body.reason,300)||!['json','csv'].includes(body.format)||typeof body.data!=='string')return json({error:'Choose a format, source label, reason and import request ID.'},400);
  const canonical={sourceLabel:body.sourceLabel.trim(),reason:body.reason.trim(),format:body.format,data:body.data};
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical)))),value=>value.toString(16).padStart(2,'0')).join('');
  const prior=await env.DB.prepare(`SELECT ${batchFields},request_hash AS requestHash FROM finance_import_batches WHERE id=?`).bind(body.requestId).first();
  if(prior)return prior.requestHash===hash?json({...summary(prior),idempotentReplay:true}):json({error:'This import request ID belongs to different input. Start a new import.'},409);
  let input;try{input=parseImportData(body.format,body.data);}catch(error){return json({error:error.message},400);}
  if(input.length<1||input.length>200)return json({error:'Provide 1–200 transaction rows.'},400);
  const rows=input.map((rawRow,index)=>{
   const row={rowNumber:index+1,rawJson:JSON.stringify(canonicalSnapshot(rawRow)),flagsJson:'[]',transactionJson:null,source:null,externalReference:null,issue:'',verdict:'rejected'};
   try{const transaction=normaliseImportRow(rawRow,body.format);row.transactionJson=JSON.stringify(transaction);row.source=transaction.source;row.externalReference=transaction.externalReference;}catch(error){row.issue=error.message;}
   return row;
  });
  const keys=JSON.stringify(rows.filter(row=>row.transactionJson).map(row=>({source:row.source,reference:row.externalReference})));
  const staged=await env.DB.prepare("SELECT f.source,f.external_reference AS externalReference,f.transaction_json AS transactionJson FROM finance_import_rows f WHERE f.verdict='accepted' AND EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.source')=f.source AND json_extract(j.value,'$.reference')=f.external_reference)").bind(keys).all();
  const ledger=await env.DB.prepare("SELECT f.source,f.external_reference AS externalReference,f.student_id AS studentId,f.course_code AS courseCode,f.transaction_kind AS transactionKind,f.gross_paise AS grossPaise,f.fee_paise AS feePaise,f.net_paise AS netPaise,f.paid_at AS paidAt FROM finance_transactions f WHERE EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.source')=f.source AND json_extract(j.value,'$.reference')=f.external_reference)").bind(keys).all();
  const keyFor=row=>JSON.stringify([row.source,row.externalReference]),saved=new Map((staged.results||[]).map(row=>[keyFor(row),row.transactionJson])),existingLedger=new Map((ledger.results||[]).map(row=>[keyFor(row),JSON.stringify(row)])),seen=new Map();
  let acceptedRows=0,duplicateRows=0,rejectedRows=0;
  for(const row of rows){
   if(!row.transactionJson){rejectedRows++;continue;}
   const transaction=JSON.parse(row.transactionJson),key=keyFor(transaction),previous=seen.get(key)??saved.get(key)??existingLedger.get(key);
   const flags=[transaction.studentId?'learner_match_pending':'learner_missing',...(transaction.transactionKind==='activation'?['activation_match_pending']:[])];
   if(previous!==undefined){row.verdict='duplicate';duplicateRows++;row.issue=previous===row.transactionJson?'Repeated source/reference; excluded from accepted review rows.':'Repeated source/reference has conflicting details; review the source.';if(previous!==row.transactionJson)flags.push('reference_conflict');if(existingLedger.has(key))flags.push('existing_transaction_reference');}
   else{row.verdict='accepted';acceptedRows++;seen.set(key,row.transactionJson);}
   row.flagsJson=JSON.stringify(flags);
  }
  const batch=env.DB.prepare('INSERT INTO finance_import_batches(id,request_hash,source_label,imported_by,reason,total_rows,accepted_rows,duplicate_rows,rejected_rows,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(body.requestId,hash,canonical.sourceLabel,user.userId,canonical.reason,rows.length,acceptedRows,duplicateRows,rejectedRows,Date.now());
  const records=env.DB.prepare(`INSERT INTO finance_import_rows(id,batch_id,row_number,verdict,source,external_reference,transaction_json,raw_json,flags_json,issue) SELECT ?||':'||json_extract(value,'$.rowNumber'),?,json_extract(value,'$.rowNumber'),json_extract(value,'$.verdict'),json_extract(value,'$.source'),json_extract(value,'$.externalReference'),json_extract(value,'$.transactionJson'),json_extract(value,'$.rawJson'),json_extract(value,'$.flagsJson'),json_extract(value,'$.issue') FROM json_each(?)`).bind(body.requestId,body.requestId,JSON.stringify(rows));
  try{await env.DB.batch([batch,records]);}
  catch(error){
   if(!/UNIQUE constraint failed/.test(error.message))throw error;
   const concurrent=await env.DB.prepare(`SELECT ${batchFields},request_hash AS requestHash FROM finance_import_batches WHERE id=?`).bind(body.requestId).first();
   if(concurrent?.requestHash===hash)return json({...summary(concurrent),idempotentReplay:true});
   return json({error:'Another import saved this request or reference. Reload before importing again.'},409);
  }
  return json({batchId:body.requestId,totalRows:rows.length,acceptedRows,duplicateRows,rejectedRows,verification:'unverified',idempotentReplay:false},201);
 }catch{return json({error:'Payment import review unavailable. No partial batch is retained.'},503);}
}
