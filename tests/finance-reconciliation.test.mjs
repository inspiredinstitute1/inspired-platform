import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTransaction,reconcileTransactions} from '../lib/finance-reconciliation.mjs';
const base={source:'phonepe',externalReference:'TXN-001',studentId:'student1',courseCode:'COMBO',transactionKind:'tuition',grossPaise:149900,feePaise:0,netPaise:149900,paidAt:'2026-10-19'};
test('accept consistent Indian rupee paise transaction',()=>assert.equal(parseTransaction(base).netPaise,149900));
test('reject inconsistent financial values',()=>assert.throws(()=>parseTransaction({...base,netPaise:149901}),/Inconsistent/));
test('deduplicate using source and external reference',()=>{const r=reconcileTransactions([base,base]);assert.equal(r.accepted.length,1);assert.equal(r.duplicates.length,1);});
test('activation is separate from tuition, not silently counted as another course sale',()=>{const r=reconcileTransactions([base,{...base,source:'appx',externalReference:'ACT-001',transactionKind:'activation',grossPaise:1500,feePaise:500,netPaise:1000}]);assert.equal(r.unlinkedActivations.length,1);assert.match(r.note,/not confirmed tuition/);});
test('reject negative amounts',()=>assert.throws(()=>parseTransaction({...base,grossPaise:-1}),/Inconsistent/));
