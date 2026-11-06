-- Development only: manual Admin attestations are not automated provider verification.
CREATE TABLE IF NOT EXISTS finance_evidence_decisions (
 row_id TEXT PRIMARY KEY REFERENCES finance_reviews(row_id) ON DELETE RESTRICT,
 review_version INTEGER NOT NULL CHECK(review_version>=1),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 status TEXT NOT NULL CHECK(status IN ('pending','confirmed','disputed')),
 method TEXT NOT NULL CHECK(method IN ('not_checked','provider_statement','provider_dashboard','original_receipt')),
 attested INTEGER NOT NULL CHECK(attested IN (0,1)),
 notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 CHECK((status='confirmed' AND attested=1 AND method!='not_checked' AND length(trim(notes))>=3) OR (status!='confirmed' AND attested=0))
);
CREATE TABLE IF NOT EXISTS finance_evidence_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 row_id TEXT NOT NULL REFERENCES finance_evidence_decisions(row_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finance_evidence_audit_row ON finance_evidence_audit(row_id,id);
CREATE TRIGGER IF NOT EXISTS finance_evidence_guard_insert BEFORE INSERT ON finance_evidence_decisions
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews r JOIN finance_import_rows f ON f.id=r.row_id WHERE r.row_id=NEW.row_id AND r.version=NEW.review_version AND f.verdict='accepted' AND NEW.snapshot_json=json_object('rowId',r.row_id,'reviewVersion',r.version,'learnerId',r.learner_id,'nodeId',r.node_id,'reviewStatus',r.status,'evidenceReference',r.evidence_reference,'evidenceNotes',r.evidence_notes,'transaction',json(f.transaction_json)) AND (NEW.status!='confirmed' OR r.status='reviewed'))
 BEGIN SELECT RAISE(ABORT,'Evidence decision requires the current saved review snapshot'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_insert AFTER INSERT ON finance_evidence_decisions BEGIN
 INSERT INTO finance_evidence_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,NULL,json_object('row_id',NEW.row_id,'review_version',NEW.review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'method',NEW.method,'attested',NEW.attested,'notes',NEW.notes,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_guard_update BEFORE UPDATE ON finance_evidence_decisions
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews r JOIN finance_import_rows f ON f.id=r.row_id WHERE r.row_id=NEW.row_id AND r.version=NEW.review_version AND f.verdict='accepted' AND NEW.snapshot_json=json_object('rowId',r.row_id,'reviewVersion',r.version,'learnerId',r.learner_id,'nodeId',r.node_id,'reviewStatus',r.status,'evidenceReference',r.evidence_reference,'evidenceNotes',r.evidence_notes,'transaction',json(f.transaction_json)) AND (NEW.status!='confirmed' OR r.status='reviewed'))
 BEGIN SELECT RAISE(ABORT,'Evidence decision requires the current saved review snapshot'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_update AFTER UPDATE ON finance_evidence_decisions BEGIN
 INSERT INTO finance_evidence_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,json_object('row_id',OLD.row_id,'review_version',OLD.review_version,'snapshot_json',OLD.snapshot_json,'status',OLD.status,'method',OLD.method,'attested',OLD.attested,'notes',OLD.notes,'version',OLD.version),json_object('row_id',NEW.row_id,'review_version',NEW.review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'method',NEW.method,'attested',NEW.attested,'notes',NEW.notes,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_identity BEFORE UPDATE ON finance_evidence_decisions WHEN OLD.row_id!=NEW.row_id BEGIN SELECT RAISE(ABORT,'Evidence row identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_version_insert BEFORE INSERT ON finance_evidence_decisions WHEN NEW.version!=1 BEGIN SELECT RAISE(ABORT,'Invalid evidence version'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_version_update BEFORE UPDATE ON finance_evidence_decisions WHEN NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Invalid evidence version'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_no_delete BEFORE DELETE ON finance_evidence_decisions BEGIN SELECT RAISE(ABORT,'Retain evidence decisions'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_no_update BEFORE UPDATE ON finance_evidence_audit BEGIN SELECT RAISE(ABORT,'Evidence audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_no_delete BEFORE DELETE ON finance_evidence_audit BEGIN SELECT RAISE(ABORT,'Evidence audit is append-only'); END;
