import {normaliseLedgerRow,ledgerEvidence} from './finance-cross-batch-context.mjs';
import {previewLedger} from './finance-ledger-policy.mjs';
export const APPROVAL_POLICY='review-snapshot-v1';
// One database read defines membership and values. Reused inside the guarded write.
export const approvalScopeSQL=`WITH selected AS (
 SELECT id,row_number FROM finance_import_rows WHERE batch_id=?1 AND verdict='accepted'
), targets AS (
 SELECT f.id FROM finance_import_rows f JOIN selected x ON x.id=f.id WHERE json_extract(f.transaction_json,'$.transactionKind') IN ('tuition','mock_test')
 UNION SELECT target_row_id FROM finance_payment_links WHERE row_id IN (SELECT id FROM selected)
), peers AS (
 SELECT row_id FROM finance_payment_links WHERE target_row_id IN (SELECT id FROM targets) ORDER BY row_id LIMIT 401
), scope_ids AS (
 SELECT id FROM selected UNION SELECT id FROM targets UNION SELECT row_id FROM peers
), limited_scope AS (SELECT id FROM scope_ids ORDER BY id LIMIT 601)
SELECT json_object('policy','${APPROVAL_POLICY}','adminEmail',?2,
 'batch',(SELECT json_object('id',id,'sourceLabel',source_label,'requestHash',request_hash,'totalRows',total_rows,'acceptedRows',accepted_rows,'duplicateRows',duplicate_rows,'rejectedRows',rejected_rows) FROM finance_import_batches WHERE id=?1),
 'selectedIds',json((SELECT json_group_array(id) FROM (SELECT id FROM selected ORDER BY row_number))),
 'targetIds',json((SELECT json_group_array(id) FROM (SELECT id FROM targets ORDER BY id))),
 'rows',json((SELECT json_group_array(json(value)) FROM (
 SELECT json_object('rowId',f.id,'batchId',f.batch_id,'rowNumber',f.row_number,'transaction',json(f.transaction_json),
 'review',CASE WHEN r.row_id IS NULL THEN NULL ELSE json_object('version',r.version,'status',r.status,'learnerId',r.learner_id,'nodeId',r.node_id,'evidenceReference',r.evidence_reference,'evidenceNotes',r.evidence_notes,'actor',r.changed_by,'reason',r.change_reason,'updatedAt',r.updated_at) END,
 'identityRevision',COALESCE(iv.version,0),
 'account',CASE WHEN p.user_id IS NULL THEN NULL ELSE json_object('id',p.user_id,'email',p.email,'name',p.display_name) END,
 'programme',CASE WHEN n.id IS NULL THEN NULL ELSE json_object('id',n.id,'kind',n.kind,'title',n.title,'status',n.status,'version',n.version) END,
 'evidence',CASE WHEN e.row_id IS NULL THEN NULL ELSE json_object('version',e.version,'reviewVersion',e.review_version,'status',e.status,'method',e.method,'attested',e.attested,'notes',e.notes,'snapshot',json(e.snapshot_json),'actor',e.changed_by,'reason',e.change_reason,'updatedAt',e.updated_at) END,
 'link',CASE WHEN l.row_id IS NULL THEN NULL ELSE json_object('version',l.version,'targetRowId',l.target_row_id,'sourceReviewVersion',l.source_review_version,'targetReviewVersion',l.target_review_version,'status',l.status,'snapshot',json(l.snapshot_json),'actor',l.changed_by,'reason',l.change_reason,'updatedAt',l.updated_at) END) AS value
 FROM finance_import_rows f JOIN limited_scope x ON x.id=f.id LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN finance_approval_state_versions iv ON iv.kind='identity' AND iv.entity_key=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id LEFT JOIN finance_evidence_decisions e ON e.row_id=f.id LEFT JOIN finance_payment_links l ON l.row_id=f.id ORDER BY f.id
 ))),
 'ledgerStates',json((SELECT json_group_array(json(value)) FROM (SELECT json_object('source',f.source,'externalReference',f.external_reference,'version',COALESCE(v.version,0)) AS value FROM finance_import_rows f JOIN limited_scope x ON x.id=f.id LEFT JOIN finance_approval_state_versions v ON v.kind='ledger' AND v.entity_key=json_array(f.source,f.external_reference) ORDER BY f.id))),
 'ledger',json((SELECT json_group_array(json(value)) FROM (
 SELECT json_object('id',l.id,'source',l.source,'externalReference',l.external_reference,'studentId',l.student_id,'courseCode',l.course_code,'kind',l.transaction_kind,'grossPaise',l.gross_paise,'feePaise',l.fee_paise,'netPaise',l.net_paise,'paidAt',l.paid_at,'verification',l.verification,'linkedTuitionId',l.linked_tuition_id,'importedAt',l.imported_at) AS value
 FROM finance_transactions l WHERE EXISTS(SELECT 1 FROM finance_import_rows f JOIN limited_scope x ON x.id=f.id WHERE f.source=l.source AND f.external_reference=l.external_reference) ORDER BY l.id
 )))
) AS scopeJson,(SELECT COUNT(*) FROM scope_ids) AS rowCount,(SELECT COUNT(*) FROM peers) AS peerCount`;
export const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('');
export function evaluateApprovalScope(scope,env){
 const all=scope.rows.map(item=>({...normaliseLedgerRow({rowId:item.rowId,transactionJson:JSON.stringify(item.transaction),version:item.review?.version||0,status:item.review?.status||'pending',learnerId:item.review?.learnerId,nodeId:item.review?.nodeId,evidenceReference:item.review?.evidenceReference||'',savedLearner:item.account?.id,learnerEmail:item.account?.email,programmeKind:item.programme?.kind,evidenceDecisionVersion:item.evidence?.version||0,evidenceReviewVersion:item.evidence?.reviewVersion,evidenceStatus:item.evidence?.status},env),captured:item})),byId=new Map(all.map(row=>[row.rowId,row])),selected=new Set(scope.selectedIds);
 const selectedRows=scope.selectedIds.map(id=>byId.get(id));
 const state=row=>{const link=row.captured.link,target=link&&byId.get(link.targetRowId);return!link?'not_linked':link.status==='revoked'?'revoked':link.sourceReviewVersion!==row.version||link.targetReviewVersion!==target?.version?'stale':row.status!=='reviewed'||target.status!=='reviewed'||!row.learnerEligible||!target.learnerEligible||!row.programmeEligible||!target.programmeEligible||row.learnerId!==target.learnerId||row.nodeId!==target.nodeId?'unavailable':'active';};
 const dependent=selectedRows.filter(row=>['activation','refund'].includes(row.transaction.transactionKind)),links=dependent.filter(row=>state(row)==='active').map(row=>({rowId:row.rowId,targetRowId:row.captured.link.targetRowId}));
 const contextRows=[...new Set(links.map(link=>link.targetRowId).filter(id=>!selected.has(id)))].map(id=>byId.get(id));
 const reservations=new Map();
 for(const row of all){const l=row.captured.link,t=l&&byId.get(l.targetRowId);if(selected.has(row.rowId)||!l||l.status!=='active'||row.version!==l.sourceReviewVersion||t?.version!==l.targetReviewVersion||row.status!=='reviewed'||t.status!=='reviewed')continue;const reserved=reservations.get(t.rowId)||{targetRowId:t.rowId,refundPaise:0,activationCount:0};if(row.transaction.transactionKind==='refund')reserved.refundPaise+=row.transaction.grossPaise;if(row.transaction.transactionKind==='activation')reserved.activationCount++;if(!Number.isSafeInteger(reserved.refundPaise))throw Error('Peer commitments exceed safe preview limits.');reservations.set(t.rowId,reserved);}
 const preview=previewLedger(selectedRows,links,scope.ledger,{contextRows,reservations:[...reservations.values()]});
 preview.rows=preview.rows.map(row=>({...row,...ledgerEvidence(byId.get(row.rowId)),savedLinkState:state(byId.get(row.rowId)),savedLinkVersion:byId.get(row.rowId).captured.link?.version||0}));
 preview.manualEvidenceComplete=[...selectedRows,...contextRows].every(row=>ledgerEvidence(row).evidenceState==='confirmed');
 preview.linkMode='saved';preview.totalsScope='selected_batch_movement';preview.contextTargets=contextRows.map(row=>({rowId:row.rowId,...ledgerEvidence(row),receiptsCounted:false}));preview.otherBatchReservations=[...reservations.values()];
 const blockers=[];if(!selectedRows.length)blockers.push('no_accepted_rows');if(!preview.totalsComplete||preview.blockedCount)blockers.push('payment_rules_incomplete');if(!preview.manualEvidenceComplete)blockers.push('current_manual_evidence_decisions_required');
 return{eligibleForReviewApproval:!blockers.length,reviewBlockers:blockers,preview};
}
export async function captureApprovalScope(DB,batchId,env){
 const record=await DB.prepare(approvalScopeSQL).bind(batchId,env.PORTAL_ADMIN_EMAIL.toLowerCase()).first();
 if(record.rowCount>600||record.peerCount>400||new TextEncoder().encode(record.scopeJson).length>250000)throw Error('Approval scope exceeds bounded review limits.');
 const scope=JSON.parse(record.scopeJson);if(!scope.batch)return null;
 return{scope,scopeJson:record.scopeJson,scopeHash:await digest(record.scopeJson),...evaluateApprovalScope(scope,env)};
}
