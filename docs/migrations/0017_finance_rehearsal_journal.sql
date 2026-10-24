-- Development only: separate, synthetic-only rehearsal. No finance_transactions or access writes.
CREATE TABLE IF NOT EXISTS finance_rehearsal_operations (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('post','reverse')),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 approval_id TEXT UNIQUE REFERENCES finance_approval_snapshots(id) ON DELETE RESTRICT,
 reverses_id TEXT UNIQUE REFERENCES finance_rehearsal_operations(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),
 created_at INTEGER NOT NULL,
 CHECK((kind='post' AND approval_id IS NOT NULL AND reverses_id IS NULL) OR (kind='reverse' AND approval_id IS NULL AND reverses_id IS NOT NULL AND reverses_id!=id))
);
CREATE TABLE IF NOT EXISTS finance_rehearsal_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 operation_id TEXT NOT NULL REFERENCES finance_rehearsal_operations(id) ON DELETE RESTRICT,
 row_id TEXT NOT NULL REFERENCES finance_import_rows(id) ON DELETE RESTRICT,
 target_row_id TEXT REFERENCES finance_import_rows(id) ON DELETE RESTRICT,
 original_entry_id INTEGER UNIQUE REFERENCES finance_rehearsal_entries(id) ON DELETE RESTRICT,
 tuition_paise INTEGER NOT NULL,
 mock_paise INTEGER NOT NULL,
 activation_paise INTEGER NOT NULL,
 fee_paise INTEGER NOT NULL,
 refund_paise INTEGER NOT NULL,
 cash_paise INTEGER NOT NULL,
 UNIQUE(operation_id,row_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rehearsal_original_row ON finance_rehearsal_entries(row_id) WHERE original_entry_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_rehearsal_target ON finance_rehearsal_entries(target_row_id);
CREATE TABLE IF NOT EXISTS finance_rehearsal_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 operation_id TEXT NOT NULL UNIQUE REFERENCES finance_rehearsal_operations(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL,actor_id TEXT NOT NULL,reason TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE VIEW IF NOT EXISTS finance_rehearsal_projection AS
 SELECT s.id AS approval_id,json_extract(r.value,'$.rowId') AS row_id,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind') IN ('activation','refund') THEN json_extract(r.value,'$.link.targetRowId') END AS target_row_id,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')='tuition' THEN json_extract(r.value,'$.transaction.grossPaise') WHEN json_extract(r.value,'$.transaction.transactionKind')='refund' AND json_extract(t.value,'$.transaction.transactionKind')='tuition' THEN -json_extract(r.value,'$.transaction.grossPaise') ELSE 0 END AS tuition_paise,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')='mock_test' THEN json_extract(r.value,'$.transaction.grossPaise') WHEN json_extract(r.value,'$.transaction.transactionKind')='refund' AND json_extract(t.value,'$.transaction.transactionKind')='mock_test' THEN -json_extract(r.value,'$.transaction.grossPaise') ELSE 0 END AS mock_paise,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')='activation' THEN json_extract(r.value,'$.transaction.grossPaise') ELSE 0 END AS activation_paise,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')!='refund' THEN json_extract(r.value,'$.transaction.feePaise') ELSE 0 END AS fee_paise,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')='refund' THEN json_extract(r.value,'$.transaction.grossPaise') ELSE 0 END AS refund_paise,
 CASE WHEN json_extract(r.value,'$.transaction.transactionKind')='refund' THEN -json_extract(r.value,'$.transaction.netPaise') ELSE json_extract(r.value,'$.transaction.netPaise') END AS cash_paise
 FROM finance_approval_snapshots s JOIN json_each(s.scope_json,'$.rows') r
 LEFT JOIN json_each(s.scope_json,'$.rows') t ON json_extract(t.value,'$.rowId')=json_extract(r.value,'$.link.targetRowId')
 WHERE EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.selectedIds') x WHERE x.value=json_extract(r.value,'$.rowId'));
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_post_guard BEFORE INSERT ON finance_rehearsal_operations
 WHEN NEW.kind='post' AND NOT EXISTS(
 SELECT 1 FROM finance_approval_snapshots s WHERE s.id=NEW.approval_id AND s.decision='review_approved' AND s.attested=1
 AND substr(json_extract(s.scope_json,'$.batch.sourceLabel'),1,10)='Synthetic '
 AND NOT EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.rows') r WHERE substr(json_extract(r.value,'$.transaction.externalReference'),1,10) IS NOT 'SYNTHETIC-')
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
) AS scopeJson,(SELECT COUNT(*) FROM scope_ids) AS rowCount,(SELECT COUNT(*) FROM peers) AS peerCount) current WHERE current.scopeJson=s.scope_json AND current.rowCount<=600 AND current.peerCount<=400)
 ) BEGIN SELECT RAISE(ABORT,'Rehearsal conflict: current synthetic approval required'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_reverse_guard BEFORE INSERT ON finance_rehearsal_operations
 WHEN NEW.kind='reverse' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_rehearsal_operations WHERE id=NEW.reverses_id AND kind='post') OR EXISTS(SELECT 1 FROM finance_rehearsal_operations WHERE reverses_id=NEW.reverses_id) THEN RAISE(ABORT,'Rehearsal conflict: original must be an unreversed post') END;
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM finance_rehearsal_entries child JOIN finance_rehearsal_entries parent ON parent.row_id=child.target_row_id
 WHERE parent.operation_id=NEW.reverses_id AND parent.original_entry_id IS NULL AND child.original_entry_id IS NULL AND child.operation_id!=NEW.reverses_id
 AND NOT EXISTS(SELECT 1 FROM finance_rehearsal_entries reversed WHERE reversed.original_entry_id=child.id)
 ) THEN RAISE(ABORT,'Rehearsal conflict: reverse dependent posts first') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_entry_guard BEFORE INSERT ON finance_rehearsal_entries BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM finance_rehearsal_operations o JOIN finance_rehearsal_projection p ON p.approval_id=o.approval_id
 WHERE o.id=NEW.operation_id AND o.kind='post' AND NEW.original_entry_id IS NULL
 AND json_array(p.row_id,p.target_row_id,p.tuition_paise,p.mock_paise,p.activation_paise,p.fee_paise,p.refund_paise,p.cash_paise)=json_array(NEW.row_id,NEW.target_row_id,NEW.tuition_paise,NEW.mock_paise,NEW.activation_paise,NEW.fee_paise,NEW.refund_paise,NEW.cash_paise)
 UNION ALL
 SELECT 1 FROM finance_rehearsal_operations o JOIN finance_rehearsal_entries e ON e.operation_id=o.reverses_id
 WHERE o.id=NEW.operation_id AND o.kind='reverse' AND e.id=NEW.original_entry_id AND e.original_entry_id IS NULL
 AND json_array(e.row_id,e.target_row_id,-e.tuition_paise,-e.mock_paise,-e.activation_paise,-e.fee_paise,-e.refund_paise,-e.cash_paise)=json_array(NEW.row_id,NEW.target_row_id,NEW.tuition_paise,NEW.mock_paise,NEW.activation_paise,NEW.fee_paise,NEW.refund_paise,NEW.cash_paise)
 ) THEN RAISE(ABORT,'Rehearsal conflict: entries must match captured movements or exact compensation') END;
END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_materialize AFTER INSERT ON finance_rehearsal_operations BEGIN
 INSERT INTO finance_rehearsal_entries(operation_id,row_id,target_row_id,original_entry_id,tuition_paise,mock_paise,activation_paise,fee_paise,refund_paise,cash_paise)
 SELECT NEW.id,p.row_id,p.target_row_id,NULL,p.tuition_paise,p.mock_paise,p.activation_paise,p.fee_paise,p.refund_paise,p.cash_paise FROM finance_rehearsal_projection p WHERE NEW.kind='post' AND p.approval_id=NEW.approval_id;
 -- Every external original must already exist as an active rehearsal receipt.
 SELECT CASE WHEN NEW.kind='post' AND EXISTS(
 SELECT 1 FROM finance_rehearsal_entries child WHERE child.operation_id=NEW.id AND child.target_row_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM finance_rehearsal_entries parent WHERE parent.row_id=child.target_row_id AND parent.original_entry_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM finance_rehearsal_entries reversed WHERE reversed.original_entry_id=parent.id)
 AND (SELECT r.value FROM finance_rehearsal_operations o JOIN finance_approval_snapshots s ON s.id=o.approval_id JOIN json_each(s.scope_json,'$.rows') r WHERE o.id=parent.operation_id AND json_extract(r.value,'$.rowId')=parent.row_id)
 = (SELECT r.value FROM finance_approval_snapshots s JOIN json_each(s.scope_json,'$.rows') r WHERE s.id=NEW.approval_id AND json_extract(r.value,'$.rowId')=parent.row_id)
 )) THEN RAISE(ABORT,'Rehearsal conflict: target must have an active rehearsal post') END;
 -- Persisted rehearsal commitments still count after saved links are revoked or changed.
 SELECT CASE WHEN NEW.kind='post' AND EXISTS(
 SELECT 1 FROM finance_rehearsal_entries child JOIN finance_import_rows target ON target.id=child.target_row_id JOIN finance_import_rows source ON source.id=child.row_id
 WHERE child.original_entry_id IS NULL AND child.target_row_id IN (SELECT target_row_id FROM finance_rehearsal_entries WHERE operation_id=NEW.id)
 AND NOT EXISTS(SELECT 1 FROM finance_rehearsal_entries reversed WHERE reversed.original_entry_id=child.id)
 GROUP BY child.target_row_id HAVING SUM(child.refund_paise)>json_extract(target.transaction_json,'$.grossPaise') OR SUM(CASE WHEN json_extract(source.transaction_json,'$.transactionKind')='activation' THEN 1 ELSE 0 END)>1
 ) THEN RAISE(ABORT,'Rehearsal conflict: active journal commitments exceed original') END;
 INSERT INTO finance_rehearsal_entries(operation_id,row_id,target_row_id,original_entry_id,tuition_paise,mock_paise,activation_paise,fee_paise,refund_paise,cash_paise)
 SELECT NEW.id,e.row_id,e.target_row_id,e.id,-e.tuition_paise,-e.mock_paise,-e.activation_paise,-e.fee_paise,-e.refund_paise,-e.cash_paise FROM finance_rehearsal_entries e WHERE NEW.kind='reverse' AND e.operation_id=NEW.reverses_id AND e.original_entry_id IS NULL;
 INSERT INTO finance_rehearsal_audit(operation_id,kind,actor_id,reason,changed_at) VALUES(NEW.id,NEW.kind,NEW.actor_id,NEW.reason,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_operation_no_update BEFORE UPDATE ON finance_rehearsal_operations BEGIN SELECT RAISE(ABORT,'Rehearsal operations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_operation_no_delete BEFORE DELETE ON finance_rehearsal_operations BEGIN SELECT RAISE(ABORT,'Retain rehearsal operations'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_entry_no_update BEFORE UPDATE ON finance_rehearsal_entries BEGIN SELECT RAISE(ABORT,'Rehearsal entries are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_entry_no_delete BEFORE DELETE ON finance_rehearsal_entries BEGIN SELECT RAISE(ABORT,'Retain rehearsal entries'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_audit_no_update BEFORE UPDATE ON finance_rehearsal_audit BEGIN SELECT RAISE(ABORT,'Rehearsal audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_audit_no_delete BEFORE DELETE ON finance_rehearsal_audit BEGIN SELECT RAISE(ABORT,'Retain rehearsal audit'); END;
