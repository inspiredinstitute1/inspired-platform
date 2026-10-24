import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {financeImportsEndpoint} from '../lib/finance-import-service.mjs';
import {csvRecords,normaliseImportRow} from '../lib/finance-import-parser.mjs';
const owner={userId:'owner',email:'owner@example.test'},student={userId:'student',email:'student@example.test'};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of ['drizzle/0000_far_dust.sql','docs/migrations/0003_finance_reconciliation.sql','docs/migrations/0011_finance_import_staging.sql'])db.exec(readFileSync(file,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);const wrap=(values=[])=>({bind(...v){return wrap(v)},async all(){return{results:statement.all(...values)}},async first(){return statement.get(...values)??null},async run(){return{meta:{changes:Number(statement.run(...values).changes)}}}});return wrap()},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const env={DB,PORTAL_ADMIN_EMAIL:owner.email};
 const row={source:'phonepe',externalReference:'SYNTHETIC-1',studentId:'claimed-student',courseCode:'HSTR',transactionKind:'tuition',grossPaise:99900,feePaise:0,netPaise:99900,paidAt:'2026-10-19'};
 const body=(rows=[row],changes={})=>({requestId:crypto.randomUUID(),sourceLabel:'Synthetic mapped export',reason:'Review synthetic import',format:'json',data:JSON.stringify(rows),...changes});
 const request=(method='GET',body,origin='https://local.test',path='/api/admin/finance-imports')=>new Request('https://local.test'+path,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=(body,user=owner,method=body?'POST':'GET',origin)=>financeImportsEndpoint(request(method,body,origin),user,env);
 return{db,DB,env,row,body,request,call};
}
test('finance import review is Admin-only, origin-protected and retained rather than deleted',async()=>{
 const h=setup();try{for(const user of [null,student])for(const body of [undefined,h.body()])assert.equal((await h.call(body,user)).status,403);assert.equal((await h.call(h.body(),owner,'POST','https://other.test')).status,403);assert.equal((await h.call({},owner,'DELETE')).status,405);assert.match((await h.call()).headers.get('cache-control'),/no-store/);}finally{h.db.close()}
});
test('JSON rows stage as unverified, deduplicate in-batch references and retain invalid-row issues without ledger/access changes',async()=>{
 const h=setup();try{
  const response=await h.call(h.body([h.row,h.row,{...h.row,externalReference:'BAD',netPaise:1},{...h.row,source:'appx',externalReference:'ACTIVATE',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000}]));assert.equal(response.status,201);const data=await response.json();assert.equal(data.acceptedRows,2);assert.equal(data.duplicateRows,1);assert.equal(data.rejectedRows,1);assert.equal(data.verification,'unverified');
  assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_transactions').get().n,0);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM learner_progress').get().n,0);
  const review=await(await h.call()).json();assert.equal(review.rows.length,4);assert(review.rows.some(row=>JSON.parse(row.flagsJson).includes('activation_match_pending')));assert(review.rows.some(row=>JSON.parse(row.flagsJson).includes('learner_match_pending')));assert(review.stagingOnly);
 }finally{h.db.close()}
});
test('CSV handles BOM, quoted commas/quotes and CRLF; malformed headers, columns, amounts and dates do not silently convert',async()=>{
 const h=setup();try{
  assert.deepEqual(csvRecords('\uFEFFa,b\r\n"x,y","a""b"\r\n'),[['a','b'],['x,y','a"b']]);assert.throws(()=>csvRecords('a\n"unclosed'),/Unclosed/);assert.throws(()=>csvRecords('a\n"closed"junk'),/Unexpected/);
  const header='source,externalReference,transactionKind,grossPaise,feePaise,netPaise,paidAt';
  const response=await h.call(h.body([],{format:'csv',data:header+'\r\nphonepe,"SYNTHETIC,CSV",tuition,99900,0,99900,2026-10-19\r\nphonepe,BAD,tuition,999.00,0,99900,2026-10-19\r\nphonepe,DATE,tuition,100,0,100,2026-02-30\r\nphonepe,SHORT\r\n'}));assert.equal(response.status,201);const data=await response.json();assert.equal(data.acceptedRows,1);assert.equal(data.rejectedRows,3);
  assert.equal((await h.call(h.body([],{format:'csv',data:'source,source\nphonepe,phonepe'}))).status,400);assert.equal((await h.call(h.body([],{format:'csv',data:header}))).status,400);
  assert.throws(()=>normaliseImportRow({...h.row,grossPaise:'99900'},'json'),/amounts/);assert.throws(()=>normaliseImportRow({...h.row,externalReference:'x\ny'},'json'),/Control/);
 }finally{h.db.close()}
});
test('identical request replay returns the saved batch; reusing its ID with different input is rejected',async()=>{
 const h=setup();try{
  const body=h.body(),first=await h.call(body);assert.equal(first.status,201);const replay=await h.call(body);assert.equal(replay.status,200);assert.equal((await replay.json()).idempotentReplay,true);assert.equal((await h.call({...body,sourceLabel:'Different export'})).status,409);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_import_rows').get().n,1);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_import_audit').get().n,1);
 }finally{h.db.close()}
});
test('references already staged or in the old transaction table are excluded and conflicting details are flagged',async()=>{
 const h=setup();try{
  await h.call(h.body());h.db.prepare("INSERT INTO finance_transactions(source,external_reference,transaction_kind,gross_paise,fee_paise,net_paise,paid_at,imported_at) VALUES('phonepe','LEGACY','tuition',100,0,100,'2026-10-19',1)").run();
  const response=await h.call(h.body([{...h.row,grossPaise:100,netPaise:100},{...h.row,externalReference:'LEGACY'}]));assert.equal((await response.json()).duplicateRows,2);const data=await(await h.call()).json();assert(data.rows.every(row=>JSON.parse(row.flagsJson).includes('reference_conflict')));assert(data.rows.some(row=>JSON.parse(row.flagsJson).includes('existing_transaction_reference')));assert.equal(h.db.prepare("SELECT COUNT(*) AS n FROM finance_import_rows WHERE verdict='accepted'").get().n,1);
 }finally{h.db.close()}
});
test('a batch and all rows/audits roll back together when row persistence or the batch audit fails',async()=>{
 for(const table of ['finance_import_rows','finance_import_audit']){const h=setup();try{h.db.exec("CREATE TRIGGER reject_import BEFORE INSERT ON "+table+" BEGIN SELECT RAISE(ABORT,'Synthetic failure'); END;");assert.equal((await h.call(h.body())).status,503);for(const name of ['finance_import_batches','finance_import_rows','finance_import_audit'])assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM '+name).get().n,0);}finally{h.db.close()}}
});
test('concurrent accepted-reference conflicts roll back only the losing batch and can be safely resubmitted for duplicate review',async()=>{
 const h=setup();try{
  const original=h.DB.batch;let competing;
  h.DB.batch=async statements=>{h.DB.batch=original;competing=await h.call(h.body());return original(statements);};
  const body=h.body(),loser=await h.call(body);assert.equal(competing.status,201);assert.equal(loser.status,409);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_import_batches').get().n,1);assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_import_audit').get().n,1);
  const retry=await h.call(body);assert.equal(retry.status,201);assert.equal((await retry.json()).duplicateRows,1);
 }finally{h.db.close()}
});
test('raw snapshots retain only bounded canonical fields; forged verification and actor values are ignored',async()=>{
 const h=setup();try{
  const body=h.body([{...h.row,password:'DO-NOT-STORE',verification:'verified',courseCode:'x'.repeat(2000)}]);body.importedBy='spoof';body.verified=true;const response=await h.call(body);assert.equal(response.status,201);assert.equal((await response.json()).rejectedRows,1);
  const review=await(await h.call()).json();assert(!JSON.stringify(review).includes('DO-NOT-STORE'));assert.equal(review.selected.importedBy,'owner');assert.equal(JSON.parse(review.rows[0].rawJson).courseCode.length,1000);assert.equal(review.verification,'unverified');
 }finally{h.db.close()}
});
test('import batches, rows and audit are immutable and remain intact when the migration is reapplied',async()=>{
 const h=setup();try{
  await h.call(h.body());for(const [table,column] of [['finance_import_batches','reason'],['finance_import_rows','issue'],['finance_import_audit','reason']]){assert.throws(()=>h.db.exec('DELETE FROM '+table),/Retain|append-only/);assert.throws(()=>h.db.exec("UPDATE "+table+" SET "+column+"='tamper'"),/immutable|append-only/);}
  h.db.exec(readFileSync('docs/migrations/0011_finance_import_staging.sql','utf8'));assert.equal(h.db.prepare('SELECT COUNT(*) AS n FROM finance_import_rows').get().n,1);
  assert.throws(()=>h.db.exec("INSERT INTO finance_import_rows(id,batch_id,row_number,verdict,source,external_reference,transaction_json,raw_json,flags_json) SELECT 'extra',id,2,'accepted','cash','extra','{}','{}','[]' FROM finance_import_batches"),/immutable batch counts/);
 }finally{h.db.close()}
});
test('imports reject empty/oversized batches, malformed requests and non-JSON submissions',async()=>{
 const h=setup();try{
  for(const body of [h.body([]),h.body(Array(201).fill(h.row)),h.body([],{data:'{}'}),h.body([],{requestId:'fake'})])assert.equal((await h.call(body)).status,400);
  const big=h.body([],{data:'x'.repeat(100001)});assert.equal((await h.call(big)).status,413);
  const request=h.request('POST',h.body());request.headers.set('content-type','text/plain');assert.equal((await financeImportsEndpoint(request,owner,h.env)).status,415);
 }finally{h.db.close()}
});
