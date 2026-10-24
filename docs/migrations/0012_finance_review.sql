-- Development only: reviewed evidence references do not verify payments or grant access.
CREATE TABLE IF NOT EXISTS finance_reviews (
 row_id TEXT PRIMARY KEY REFERENCES finance_import_rows(id) ON DELETE RESTRICT,
 learner_id TEXT REFERENCES learner_progress(user_id) ON DELETE RESTRICT,
 node_id TEXT REFERENCES content_nodes(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('pending','reviewed','disputed')),
 evidence_reference TEXT NOT NULL DEFAULT '' CHECK(length(evidence_reference)<=200),
 evidence_notes TEXT NOT NULL DEFAULT '' CHECK(length(evidence_notes)<=1000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 CHECK(status!='reviewed' OR (learner_id IS NOT NULL AND node_id IS NOT NULL AND length(trim(evidence_reference))>=3))
);
CREATE TABLE IF NOT EXISTS finance_review_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 row_id TEXT NOT NULL REFERENCES finance_reviews(row_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS finance_review_guard_insert BEFORE INSERT ON finance_reviews
 WHEN NOT EXISTS(SELECT 1 FROM finance_import_rows WHERE id=NEW.row_id AND verdict='accepted')
 OR (NEW.node_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series')))
 BEGIN SELECT RAISE(ABORT,'Review accepted rows and saved programmes only'); END;
CREATE TRIGGER IF NOT EXISTS finance_review_audit_insert AFTER INSERT ON finance_reviews BEGIN
 INSERT INTO finance_review_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,NULL,json_object('row_id',NEW.row_id,'learner_id',NEW.learner_id,'node_id',NEW.node_id,'status',NEW.status,'evidence_reference',NEW.evidence_reference,'evidence_notes',NEW.evidence_notes,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_review_guard_update BEFORE UPDATE ON finance_reviews
 WHEN NOT EXISTS(SELECT 1 FROM finance_import_rows WHERE id=NEW.row_id AND verdict='accepted')
 OR (NEW.node_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series')))
 BEGIN SELECT RAISE(ABORT,'Review accepted rows and saved programmes only'); END;
CREATE TRIGGER IF NOT EXISTS finance_review_audit_update AFTER UPDATE ON finance_reviews BEGIN
 INSERT INTO finance_review_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,json_object('row_id',OLD.row_id,'learner_id',OLD.learner_id,'node_id',OLD.node_id,'status',OLD.status,'evidence_reference',OLD.evidence_reference,'evidence_notes',OLD.evidence_notes,'version',OLD.version),json_object('row_id',NEW.row_id,'learner_id',NEW.learner_id,'node_id',NEW.node_id,'status',NEW.status,'evidence_reference',NEW.evidence_reference,'evidence_notes',NEW.evidence_notes,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_review_identity BEFORE UPDATE ON finance_reviews WHEN OLD.row_id!=NEW.row_id BEGIN SELECT RAISE(ABORT,'Review row identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_review_no_delete BEFORE DELETE ON finance_reviews BEGIN SELECT RAISE(ABORT,'Retain payment reviews'); END;
CREATE TRIGGER IF NOT EXISTS finance_review_audit_no_update BEFORE UPDATE ON finance_review_audit BEGIN SELECT RAISE(ABORT,'Review audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_review_audit_no_delete BEFORE DELETE ON finance_review_audit BEGIN SELECT RAISE(ABORT,'Review audit is append-only'); END;
