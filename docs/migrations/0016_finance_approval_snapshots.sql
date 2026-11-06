-- Development only. Review approval is not payment verification or ledger posting.
CREATE TABLE IF NOT EXISTS finance_approval_state_versions (
 kind TEXT NOT NULL CHECK(kind IN ('identity','ledger')),
 entity_key TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),
 PRIMARY KEY(kind,entity_key)
);
CREATE TABLE IF NOT EXISTS finance_approval_snapshots (
 id TEXT PRIMARY KEY,
 batch_id TEXT NOT NULL REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 scope_hash TEXT NOT NULL CHECK(length(scope_hash)=64),
 scope_json TEXT NOT NULL CHECK(json_valid(scope_json) AND length(CAST(scope_json AS BLOB))<=250000),
 preview_json TEXT NOT NULL CHECK(json_valid(preview_json)),
 decision TEXT NOT NULL CHECK(decision IN ('review_approved','held')),
 attested INTEGER NOT NULL CHECK(attested IN (0,1)),
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),
 created_at INTEGER NOT NULL,
 CHECK(json_extract(preview_json,'$.canPost') IS 0 AND json_extract(preview_json,'$.verification') IS 'unverified'),
 CHECK((decision='review_approved' AND attested=1 AND json_array_length(scope_json,'$.selectedIds')>0 AND json_extract(preview_json,'$.totalsComplete') IS 1 AND json_extract(preview_json,'$.blockedCount') IS 0 AND json_extract(preview_json,'$.manualEvidenceComplete') IS 1) OR (decision='held' AND attested=0))
);
CREATE INDEX IF NOT EXISTS idx_finance_approval_batch ON finance_approval_snapshots(batch_id,created_at);
CREATE INDEX IF NOT EXISTS idx_finance_approval_scope ON finance_approval_snapshots(batch_id,scope_hash);
CREATE TABLE IF NOT EXISTS finance_approval_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 snapshot_id TEXT NOT NULL UNIQUE REFERENCES finance_approval_snapshots(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,scope_hash TEXT NOT NULL,decision TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS finance_approval_scope_guard BEFORE INSERT ON finance_approval_snapshots
 WHEN NOT EXISTS(SELECT 1 FROM (WITH selected AS (
 SELECT id,row_number FROM finance_import_rows WHERE batch_id=NEW.batch_id AND verdict='accepted'
), targets AS (
 SELECT f.id FROM finance_import_rows f JOIN selected x ON x.id=f.id WHERE json_extract(f.transaction_json,'$.transactionKind') IN ('tuition','mock_test')
 UNION SELECT target_row_id FROM finance_payment_links WHERE row_id IN (SELECT id FROM selected)
), peers AS (
 SELECT row_id FROM finance_payment_links WHERE target_row_id IN (SELECT id FROM targets) ORDER BY row_id LIMIT 401
), scope_ids AS (
 SELECT id FROM selected UNION SELECT id FROM targets UNION SELECT row_id FROM peers
), limited_scope AS (SELECT id FROM scope_ids ORDER BY id LIMIT 601)
SELECT json_object('policy','review-snapshot-v1','adminEmail',json_extract(NEW.scope_json,'$.adminEmail'),
 'batch',(SELECT json_object('id',id,'sourceLabel',source_label,'requestHash',request_hash,'totalRows',total_rows,'acceptedRows',accepted_rows,'duplicateRows',duplicate_rows,'rejectedRows',rejected_rows) FROM finance_import_batches WHERE id=NEW.batch_id),
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
) AS scopeJson,(SELECT COUNT(*) FROM scope_ids) AS rowCount,(SELECT COUNT(*) FROM peers) AS peerCount) current WHERE current.scopeJson=NEW.scope_json AND current.rowCount<=600 AND current.peerCount<=400)
 BEGIN SELECT RAISE(ABORT,'Approval scope changed before save'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_insert AFTER INSERT ON finance_approval_snapshots BEGIN
 INSERT INTO finance_approval_audit(snapshot_id,actor_id,reason,scope_hash,decision,changed_at) VALUES(NEW.id,NEW.actor_id,NEW.reason,NEW.scope_hash,NEW.decision,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_approval_no_update BEFORE UPDATE ON finance_approval_snapshots BEGIN SELECT RAISE(ABORT,'Approval snapshots are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_no_delete BEFORE DELETE ON finance_approval_snapshots BEGIN SELECT RAISE(ABORT,'Retain approval snapshots'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_no_update BEFORE UPDATE ON finance_approval_audit BEGIN SELECT RAISE(ABORT,'Approval audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_no_delete BEFORE DELETE ON finance_approval_audit BEGIN SELECT RAISE(ABORT,'Approval audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_state_no_delete BEFORE DELETE ON finance_approval_state_versions BEGIN SELECT RAISE(ABORT,'Retain approval change counters'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_state_monotonic BEFORE UPDATE ON finance_approval_state_versions WHEN NEW.kind!=OLD.kind OR NEW.entity_key!=OLD.entity_key OR NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Approval counters only advance'); END;
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_insert AFTER INSERT ON learner_progress BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',NEW.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_insert AFTER INSERT ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(NEW.source,NEW.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_update AFTER UPDATE ON learner_progress WHEN OLD.email IS NOT NEW.email OR OLD.display_name IS NOT NEW.display_name BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',NEW.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_update AFTER UPDATE ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(NEW.source,NEW.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; INSERT INTO finance_approval_state_versions(kind,entity_key,version) SELECT 'ledger',json_array(OLD.source,OLD.external_reference),1 WHERE OLD.source!=NEW.source OR OLD.external_reference!=NEW.external_reference ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_delete AFTER DELETE ON learner_progress BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',OLD.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_delete AFTER DELETE ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(OLD.source,OLD.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
