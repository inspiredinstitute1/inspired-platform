-- Development only. Pending verification requests are not authenticated provider evidence.
CREATE TABLE IF NOT EXISTS finance_verification_requests (
 id TEXT PRIMARY KEY,
 approval_id TEXT NOT NULL UNIQUE REFERENCES finance_approval_snapshots(id) ON DELETE RESTRICT,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 expected_json TEXT NOT NULL CHECK(json_valid(expected_json) AND length(CAST(expected_json AS BLOB))<=250000),
 actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_verification_events (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES finance_verification_requests(id) ON DELETE RESTRICT,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 status TEXT NOT NULL CHECK(status IN ('awaiting_provider','disputed','cancelled')),
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),changed_at INTEGER NOT NULL,
 UNIQUE(task_id,version)
);
CREATE VIEW IF NOT EXISTS finance_verification_expected AS SELECT s.id AS approvalId,
 json_object('policy','independent-evidence-request-v1','requiredCurrency','INR','providerAuthenticated',json('false'),'items',json((
 SELECT json_group_array(json(item)) FROM (SELECT json_object('rowId',json_extract(r.value,'$.rowId'),'selected',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.selectedIds') x WHERE x.value=json_extract(r.value,'$.rowId')) THEN 'true' ELSE 'false' END),'transaction',json_extract(r.value,'$.transaction'),'learnerId',json_extract(r.value,'$.review.learnerId'),'nodeId',json_extract(r.value,'$.review.nodeId'),'reviewVersion',json_extract(r.value,'$.review.version'),'targetRowId',json_extract(r.value,'$.link.targetRowId')) AS item
 FROM json_each(s.scope_json,'$.rows') r WHERE EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.selectedIds') x WHERE x.value=json_extract(r.value,'$.rowId')) OR EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.targetIds') x WHERE x.value=json_extract(r.value,'$.rowId')) ORDER BY json_extract(r.value,'$.rowId'))
 ))) AS expectedJson FROM finance_approval_snapshots s;
CREATE TRIGGER IF NOT EXISTS finance_verification_request_guard BEFORE INSERT ON finance_verification_requests
 WHEN NOT EXISTS(SELECT 1 FROM finance_approval_snapshots s JOIN finance_verification_expected p ON p.approvalId=s.id WHERE s.id=NEW.approval_id AND s.decision='review_approved' AND s.attested=1 AND NEW.expected_json=p.expectedJson
 AND s.id=(SELECT a.snapshot_id FROM finance_approval_audit a JOIN finance_approval_snapshots x ON x.id=a.snapshot_id WHERE x.batch_id=s.batch_id AND x.scope_hash=s.scope_hash ORDER BY a.id DESC LIMIT 1)
 AND EXISTS(SELECT 1 FROM (WITH selected AS (
 SELECT id,row_number FROM finance_import_rows WHERE batch_id=s.batch_id AND verdict='accepted'
), targets AS (
 SELECT f.id FROM finance_import_rows f JOIN selected x ON x.id=f.id WHERE json_extract(f.transaction_json,'$.transactionKind') IN ('tuition','mock_test')
 UNION SELECT target_row_id FROM finance_payment_links WHERE row_id IN (SELECT id FROM selected)
), peers AS (
 SELECT row_id FROM finance_payment_links WHERE target_row_id IN (SELECT id FROM targets) ORDER BY row_id LIMIT 401
), scope_ids AS (
 SELECT id FROM selected UNION SELECT id FROM targets UNION SELECT row_id FROM peers
), limited_scope AS (SELECT id FROM scope_ids ORDER BY id LIMIT 601)
SELECT json_object('policy','review-snapshot-v1','adminEmail',json_extract(s.scope_json,'$.adminEmail'),
 'batch',(SELECT json_object('id',id,'sourceLabel',source_label,'requestHash',request_hash,'totalRows',total_rows,'acceptedRows',accepted_rows,'duplicateRows',duplicate_rows,'rejectedRows',rejected_rows) FROM finance_import_batches WHERE id=s.batch_id),
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
) AS scopeJson,(SELECT COUNT(*) FROM scope_ids) AS rowCount,(SELECT COUNT(*) FROM peers) AS peerCount) current WHERE current.scopeJson=s.scope_json AND current.rowCount<=600 AND current.peerCount<=400))
 BEGIN SELECT RAISE(ABORT,'Verification conflict: current captured approval and exact expected items required'); END;
CREATE TRIGGER IF NOT EXISTS finance_verification_event_guard BEFORE INSERT ON finance_verification_events BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM finance_verification_requests q WHERE q.id=NEW.task_id AND NEW.version=1 AND NEW.status='awaiting_provider' AND NEW.id=q.id AND NEW.request_hash=q.request_hash AND NEW.actor_id=q.actor_id AND NEW.reason=q.reason AND NEW.changed_at=q.created_at
 UNION ALL
 SELECT 1 FROM finance_verification_events e WHERE e.task_id=NEW.task_id AND e.version=NEW.version-1 AND e.version=(SELECT MAX(version) FROM finance_verification_events WHERE task_id=NEW.task_id) AND ((e.status='awaiting_provider' AND NEW.status IN ('disputed','cancelled')) OR (e.status='disputed' AND NEW.status='cancelled'))
 ) THEN RAISE(ABORT,'Verification conflict: stale event version or invalid transition') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_verification_requested AFTER INSERT ON finance_verification_requests BEGIN
 INSERT INTO finance_verification_events(id,task_id,request_hash,status,version,actor_id,reason,changed_at) VALUES(NEW.id,NEW.id,NEW.request_hash,'awaiting_provider',1,NEW.actor_id,NEW.reason,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_verification_request_no_update BEFORE UPDATE ON finance_verification_requests BEGIN SELECT RAISE(ABORT,'Verification requests are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_verification_request_no_delete BEFORE DELETE ON finance_verification_requests BEGIN SELECT RAISE(ABORT,'Retain verification requests'); END;
CREATE TRIGGER IF NOT EXISTS finance_verification_event_no_update BEFORE UPDATE ON finance_verification_events BEGIN SELECT RAISE(ABORT,'Verification events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_verification_event_no_delete BEFORE DELETE ON finance_verification_events BEGIN SELECT RAISE(ABORT,'Retain verification events'); END;
