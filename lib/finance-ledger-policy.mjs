// Proposed accounting rules only. Never a payment-verification or posting decision.
export function previewLedger(rows,links=[],existingReferences=[]){
 const byId=new Map(rows.map(row=>[row.rowId,row])),targets=new Map(),issues=new Map(rows.map(row=>[row.rowId,[]]));
 const add=(id,code)=>{if(!issues.get(id).includes(code))issues.get(id).push(code);};
 const existing=new Set(existingReferences.map(row=>JSON.stringify([row.source,row.externalReference]))),seen=new Set();
 for(const link of links){
  if(!byId.has(link.rowId))throw Error('Link row is outside the selected batch.');
  if(targets.has(link.rowId))throw Error('Choose only one target for each activation or refund.');
  targets.set(link.rowId,link.targetRowId);
 }
 for(const row of rows){
  const t=row.transaction,key=JSON.stringify([t.source,t.externalReference]);
  if(seen.has(key))add(row.rowId,'duplicate_reference');seen.add(key);
  if(existing.has(key))add(row.rowId,'already_in_transaction_table');
  if(row.status!=='reviewed'||!row.learnerId||!row.nodeId||!row.evidenceReference?.trim())add(row.rowId,'review_required');
  if(!row.learnerEligible||!row.programmeEligible)add(row.rowId,'saved_match_unavailable');
  if(['adjustment','other'].includes(t.transactionKind))add(row.rowId,'manual_accounting_policy_required');
  if(targets.has(row.rowId)&&!['activation','refund'].includes(t.transactionKind))add(row.rowId,'unexpected_link');
  if(t.transactionKind==='activation'&&t.source!=='appx')add(row.rowId,'activation_source_must_be_appx');
  if(t.transactionKind==='refund'&&t.feePaise!==0)add(row.rowId,'refund_fee_direction_unresolved');
 }
 for(const row of rows){
  const t=row.transaction;if(!['activation','refund'].includes(t.transactionKind))continue;
  const target=byId.get(targets.get(row.rowId));
  if(!target){add(row.rowId,'target_required_in_selected_batch');continue;}
  const tt=target.transaction;
  if(row.rowId===target.rowId||!(t.transactionKind==='activation'?tt.transactionKind==='tuition'&&tt.source!=='appx':['tuition','mock_test'].includes(tt.transactionKind)))add(row.rowId,'invalid_target_kind_or_source');
  if(!row.learnerId||row.learnerId!==target.learnerId||!row.nodeId||row.nodeId!==target.nodeId)add(row.rowId,'target_match_mismatch');
  if(t.paidAt<tt.paidAt)add(row.rowId,'target_payment_is_later');
 }
 // Exceeding a sale's gross amount blocks every refund against it, independent
 // of input order. A partial subset is never chosen silently.
 const refunds=new Map(),activations=new Map();
 for(const row of rows){
  const target=targets.get(row.rowId);if(!byId.has(target))continue;
  const kind=row.transaction.transactionKind;
  if(kind==='refund'){const group=refunds.get(target)||[];group.push(row);refunds.set(target,group);}
  if(kind==='activation'){const group=activations.get(target)||[];group.push(row);activations.set(target,group);}
 }
 for(const [target,group] of refunds){const sum=group.reduce((total,row)=>total+BigInt(row.transaction.grossPaise),0n);if(sum>BigInt(byId.get(target).transaction.grossPaise))for(const row of group)add(row.rowId,'refunds_exceed_original_gross');}
 for(const group of activations.values())if(group.length>1)for(const row of group)add(row.rowId,'multiple_activations_require_review');
 // Targets themselves must satisfy rules before dependants can contribute.
 for(const row of rows)if(['activation','refund'].includes(row.transaction.transactionKind)&&issues.get(targets.get(row.rowId))?.length)add(row.rowId,'target_is_blocked');
 const totals={tuitionGrossPaise:0n,mockGrossPaise:0n,activationGrossPaise:0n,feePaise:0n,refundPaise:0n,cashNetPaise:0n};
 const results=rows.map(row=>{
  const blockers=issues.get(row.rowId),t=row.transaction,target=byId.get(targets.get(row.rowId));
  if(!blockers.length){
   if(t.transactionKind==='tuition')totals.tuitionGrossPaise+=BigInt(t.grossPaise);
   if(t.transactionKind==='mock_test')totals.mockGrossPaise+=BigInt(t.grossPaise);
   if(t.transactionKind==='activation')totals.activationGrossPaise+=BigInt(t.grossPaise);
   if(t.transactionKind==='refund'){totals.refundPaise+=BigInt(t.grossPaise);totals[target.transaction.transactionKind==='tuition'?'tuitionGrossPaise':'mockGrossPaise']-=BigInt(t.grossPaise);totals.cashNetPaise-=BigInt(t.netPaise);}
   else{totals.feePaise+=BigInt(t.feePaise);totals.cashNetPaise+=BigInt(t.netPaise);}
  }
  return{rowId:row.rowId,version:row.version,kind:t.transactionKind,targetRowId:targets.get(row.rowId)||null,ruleEligible:!blockers.length,blockers,grantsCommunityAccess:false};
 });
 const overflow=Object.values(totals).some(value=>value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER));
 const blockedCount=results.filter(row=>!row.ruleEligible).length;
 return{previewOnly:true,verification:'unverified',canPost:false,approvalBlockers:['independent_payment_verification_required','ledger_posting_not_implemented'],rows:results,blockedCount,totalsComplete:!blockedCount&&!overflow,totals:overflow?null:Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,Number(value)])),totalsError:overflow?'safe_integer_total_exceeded':null,note:'Proposed amounts for rule-eligible rows only, not verified revenue or profit. Activation receipts remain separate from tuition. Mock-only payments do not grant group access.'};
}
