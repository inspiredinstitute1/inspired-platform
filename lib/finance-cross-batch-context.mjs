import {roleFor} from './progress-service.mjs';
import {normaliseImportRow} from './finance-import-parser.mjs';
import {effectiveEvidenceState} from './finance-evidence-service.mjs';
export function normaliseLedgerRow(row,env){
 row.transaction=normaliseImportRow(JSON.parse(row.transactionJson),'json');row.learnerEligible=!!row.savedLearner&&roleFor({email:row.learnerEmail},env)!=='Admin';row.programmeEligible=['course','test_series'].includes(row.programmeKind);return row;
}
export function ledgerEvidence(row){return{evidenceState:effectiveEvidenceState(row.evidenceDecisionVersion?{status:row.evidenceStatus,reviewVersion:row.evidenceReviewVersion}:null,row.version,row.status,row.learnerEligible&&row.programmeEligible),evidenceDecisionVersion:row.evidenceDecisionVersion||0};}
export async function crossBatchContext(DB,rows,links,env){
 const selected=new Set(rows.map(row=>row.rowId)),externalIds=[...new Set(links.map(link=>link.targetRowId).filter(id=>!selected.has(id)))];
 const saved=externalIds.length?await DB.prepare(`SELECT f.id AS rowId,f.batch_id AS batchId,f.transaction_json AS transactionJson,r.learner_id AS learnerId,r.node_id AS nodeId,r.status,r.evidence_reference AS evidenceReference,COALESCE(r.version,0) AS version,p.email AS learnerEmail,p.user_id AS savedLearner,n.kind AS programmeKind,e.status AS evidenceStatus,e.review_version AS evidenceReviewVersion,e.version AS evidenceDecisionVersion FROM finance_import_rows f LEFT JOIN finance_reviews r ON r.row_id=f.id LEFT JOIN learner_progress p ON p.user_id=r.learner_id LEFT JOIN content_nodes n ON n.id=r.node_id LEFT JOIN finance_evidence_decisions e ON e.row_id=f.id WHERE f.verdict='accepted' AND f.id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(externalIds)).all():{results:[]};
 const contextRows=(saved.results||[]).map(row=>normaliseLedgerRow(row,env));
 if(contextRows.length!==externalIds.length)throw Error('Cross-batch target missing; reload saved links.');
 const targetIds=[...new Set([...rows.filter(row=>['tuition','mock_test'].includes(row.transaction.transactionKind)).map(row=>row.rowId),...links.map(link=>link.targetRowId)])];
 const reserved=targetIds.length?await DB.prepare(`SELECT l.target_row_id AS targetRowId,SUM(CASE WHEN json_extract(f.transaction_json,'$.transactionKind')='refund' THEN json_extract(f.transaction_json,'$.grossPaise') ELSE 0 END) AS refundPaise,SUM(CASE WHEN json_extract(f.transaction_json,'$.transactionKind')='activation' THEN 1 ELSE 0 END) AS activationCount FROM finance_payment_links l JOIN finance_reviews s ON s.row_id=l.row_id AND s.version=l.source_review_version AND s.status='reviewed' JOIN finance_reviews t ON t.row_id=l.target_row_id AND t.version=l.target_review_version AND t.status='reviewed' JOIN finance_import_rows f ON f.id=s.row_id WHERE l.status='active' AND l.target_row_id IN (SELECT value FROM json_each(?)) AND l.row_id NOT IN (SELECT value FROM json_each(?)) GROUP BY l.target_row_id`).bind(JSON.stringify(targetIds),JSON.stringify([...selected])).all():{results:[]};
 return{contextRows,reservations:reserved.results||[]};
}
