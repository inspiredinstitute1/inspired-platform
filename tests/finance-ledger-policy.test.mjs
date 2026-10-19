import test from 'node:test';
import assert from 'node:assert/strict';
import {previewLedger} from '../lib/finance-ledger-policy.mjs';
const payment=(id,kind='tuition',changes={})=>({rowId:id,version:1,status:'reviewed',learnerId:'student',nodeId:'course',evidenceReference:'Synthetic receipt',learnerEligible:true,programmeEligible:true,transaction:{source:kind==='activation'?'appx':'phonepe',externalReference:id,transactionKind:kind,grossPaise:kind==='activation'?1500:99900,feePaise:kind==='activation'?500:0,netPaise:kind==='activation'?1000:99900,paidAt:'2026-10-19',...changes}});
const link=(rowId,targetRowId)=>({rowId,targetRowId});
test('tuition and linked activation stay separate; no preview permits posting or community access',()=>{
 const result=previewLedger([payment('tuition'),payment('activation','activation')],[link('activation','tuition')]);
 assert.equal(result.totals.tuitionGrossPaise,99900);assert.equal(result.totals.activationGrossPaise,1500);assert.equal(result.totals.cashNetPaise,100900);assert.equal(result.totals.feePaise,500);assert.equal(result.blockedCount,0);assert(result.totalsComplete);assert.equal(result.canPost,false);assert.equal(result.verification,'unverified');assert(result.rows.every(row=>row.grantsCommunityAccess===false));assert(result.approvalBlockers.includes('independent_payment_verification_required'));
});
test('saved pending/disputed matches, missing evidence and unavailable accounts/programmes block proposals',()=>{
 for(const changes of [{status:'pending'},{status:'disputed'},{evidenceReference:''},{learnerId:null},{nodeId:null},{learnerEligible:false},{programmeEligible:false}]){const result=previewLedger([{...payment('p'),...changes}]);assert.equal(result.blockedCount,1);assert.equal(result.totals.cashNetPaise,0);assert.equal(result.totalsComplete,false);}
});
test('activation needs an APPX source and explicit same-learner/programme direct tuition target',()=>{
 for(const kind of ['mock_test','activation']){const result=previewLedger([payment('target',kind),payment('a','activation')],[link('a','target')]);assert(result.rows[1].blockers.includes('invalid_target_kind_or_source'));}
 for(const changes of [{learnerId:'other'},{nodeId:'other'}]){const result=previewLedger([payment('t'),{...payment('a','activation'),...changes}],[link('a','t')]);assert(result.rows[1].blockers.includes('target_match_mismatch'));}
 assert(previewLedger([payment('a','activation')]).rows[0].blockers.includes('target_required_in_selected_batch'));
 assert(previewLedger([payment('t'),payment('a','activation',{source:'phonepe'})],[link('a','t')]).rows[1].blockers.includes('activation_source_must_be_appx'));
 assert(previewLedger([payment('t','tuition',{source:'appx'}),payment('a','activation')],[link('a','t')]).rows[1].blockers.includes('invalid_target_kind_or_source'));
});
test('repeated activations block every competing activation rather than choosing one',()=>{
 const result=previewLedger([payment('t'),payment('a','activation'),payment('b','activation')],[link('a','t'),link('b','t')]);assert.equal(result.blockedCount,2);assert.equal(result.totals.activationGrossPaise,0);assert(result.rows.slice(1).every(row=>row.blockers.includes('multiple_activations_require_review')));
});
test('partial tuition and mock refunds reduce only the original category and cash movement',()=>{
 const result=previewLedger([payment('t'),payment('m','mock_test',{grossPaise:19900,netPaise:19900}),payment('r','refund',{grossPaise:10000,netPaise:10000}),payment('s','refund',{grossPaise:9900,netPaise:9900})],[link('r','t'),link('s','m')]);assert.equal(result.blockedCount,0);assert.equal(result.totals.tuitionGrossPaise,89900);assert.equal(result.totals.mockGrossPaise,10000);assert.equal(result.totals.refundPaise,19900);assert.equal(result.totals.cashNetPaise,99900);
});
test('over-refunds block the entire refund group independent of order; exact full reversal is allowed',()=>{
 const rows=[payment('t'),payment('a','refund',{grossPaise:60000,netPaise:60000}),payment('b','refund',{grossPaise:40000,netPaise:40000})],links=[link('a','t'),link('b','t')];
 for(const input of [rows,[...rows].reverse()]){const result=previewLedger(input,links);assert.equal(result.blockedCount,2);assert.equal(result.totals.refundPaise,0);assert(result.rows.filter(row=>row.kind==='refund').every(row=>row.blockers.includes('refunds_exceed_original_gross')));}
 const full=previewLedger([payment('t'),payment('r','refund')],[link('r','t')]);assert.equal(full.totals.tuitionGrossPaise,0);assert.equal(full.totals.cashNetPaise,0);
});
test('refund fees, adjustment directions, self-links, unexpected links and impossible chronology require resolution',()=>{
 assert(previewLedger([payment('t'),payment('r','refund',{feePaise:1,netPaise:99899})],[link('r','t')]).rows[1].blockers.includes('refund_fee_direction_unresolved'));
 for(const kind of ['adjustment','other'])assert(previewLedger([payment('p',kind)]).rows[0].blockers.includes('manual_accounting_policy_required'));
 assert(previewLedger([payment('t'),payment('a','activation',{paidAt:'2026-10-18'})],[link('a','t')]).rows[1].blockers.includes('target_payment_is_later'));
 assert(previewLedger([payment('t')],[link('t','t')]).rows[0].blockers.includes('unexpected_link'));
 assert.throws(()=>previewLedger([payment('t')],[link('missing','t')]),/outside/);
 assert.throws(()=>previewLedger([payment('t')],[link('t','t'),link('t','t')]),/only one/);
});
test('existing transaction references block both the proposed sale and its dependants',()=>{
 const result=previewLedger([payment('t'),payment('a','activation')],[link('a','t')],[{source:'phonepe',externalReference:'t'}]);assert.equal(result.blockedCount,2);assert(result.rows[0].blockers.includes('already_in_transaction_table'));assert(result.rows[1].blockers.includes('target_is_blocked'));assert.equal(result.totals.cashNetPaise,0);
});
test('integer totals are exact and overflow is reported rather than rounded',()=>{
 const huge=Number.MAX_SAFE_INTEGER,result=previewLedger([payment('a','tuition',{grossPaise:huge,netPaise:huge}),payment('b','tuition',{grossPaise:1,netPaise:1})]);assert.equal(result.totals,null);assert.equal(result.totalsComplete,false);assert.equal(result.totalsError,'safe_integer_total_exceeded');
});
