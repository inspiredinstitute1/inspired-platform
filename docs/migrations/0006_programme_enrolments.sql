-- Development only. Manual website enrolment is not proof of payment or APPX access.
CREATE TABLE IF NOT EXISTS programme_enrolments (
 id TEXT PRIMARY KEY,
 node_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 learner_id TEXT NOT NULL REFERENCES learner_progress(user_id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('pending','active','paused','revoked','expired')),
 starts_at INTEGER NOT NULL CHECK(starts_at>=0),
 ends_at INTEGER CHECK(ends_at IS NULL OR ends_at>starts_at),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 UNIQUE(node_id,learner_id)
);
CREATE INDEX IF NOT EXISTS idx_enrolments_learner ON programme_enrolments(learner_id,status);
CREATE TABLE IF NOT EXISTS enrolment_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 enrolment_id TEXT NOT NULL REFERENCES programme_enrolments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS enrolment_kind_insert BEFORE INSERT ON programme_enrolments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series'))
 BEGIN SELECT RAISE(ABORT,'Enrol only in courses or test series'); END;
CREATE TRIGGER IF NOT EXISTS enrolment_kind_update BEFORE UPDATE ON programme_enrolments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series'))
 BEGIN SELECT RAISE(ABORT,'Enrol only in courses or test series'); END;
CREATE TRIGGER IF NOT EXISTS enrolment_identity_immutable BEFORE UPDATE ON programme_enrolments
 WHEN OLD.node_id!=NEW.node_id OR OLD.learner_id!=NEW.learner_id
 BEGIN SELECT RAISE(ABORT,'Enrolment identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS enrolment_no_delete BEFORE DELETE ON programme_enrolments
 BEGIN SELECT RAISE(ABORT,'Revoke enrolments instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS enrolment_audit_insert AFTER INSERT ON programme_enrolments BEGIN
 INSERT INTO enrolment_audit(enrolment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'node_id', NEW.node_id, 'learner_id', NEW.learner_id, 'status', NEW.status, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS enrolment_audit_update AFTER UPDATE ON programme_enrolments BEGIN
 INSERT INTO enrolment_audit(enrolment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'node_id', OLD.node_id, 'learner_id', OLD.learner_id, 'status', OLD.status, 'starts_at', OLD.starts_at, 'ends_at', OLD.ends_at, 'version', OLD.version),json_object('id', NEW.id, 'node_id', NEW.node_id, 'learner_id', NEW.learner_id, 'status', NEW.status, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS enrolment_audit_no_update BEFORE UPDATE ON enrolment_audit BEGIN SELECT RAISE(ABORT,'Enrolment audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS enrolment_audit_no_delete BEFORE DELETE ON enrolment_audit BEGIN SELECT RAISE(ABORT,'Enrolment audit is append-only'); END;
