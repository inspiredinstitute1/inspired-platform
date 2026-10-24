-- Development only. Faculty is a course-scoped read capability, not a third base role.
CREATE TABLE IF NOT EXISTS faculty_assignments (
 id TEXT PRIMARY KEY,
 course_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 faculty_id TEXT NOT NULL REFERENCES learner_progress(user_id) ON DELETE RESTRICT,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 UNIQUE(course_id,faculty_id)
);
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_account ON faculty_assignments(faculty_id,enabled);
CREATE TABLE IF NOT EXISTS faculty_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 assignment_id TEXT NOT NULL REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS faculty_course_insert BEFORE INSERT ON faculty_assignments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Assign faculty only to courses'); END;
CREATE TRIGGER IF NOT EXISTS faculty_course_update BEFORE UPDATE ON faculty_assignments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Assign faculty only to courses'); END;
CREATE TRIGGER IF NOT EXISTS faculty_identity_immutable BEFORE UPDATE ON faculty_assignments
 WHEN OLD.course_id!=NEW.course_id OR OLD.faculty_id!=NEW.faculty_id
 BEGIN SELECT RAISE(ABORT,'Faculty assignment identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS faculty_no_delete BEFORE DELETE ON faculty_assignments
 BEGIN SELECT RAISE(ABORT,'Disable faculty assignments instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS faculty_audit_insert AFTER INSERT ON faculty_assignments BEGIN
 INSERT INTO faculty_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'course_id', NEW.course_id, 'faculty_id', NEW.faculty_id, 'enabled', NEW.enabled, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS faculty_audit_update AFTER UPDATE ON faculty_assignments BEGIN
 INSERT INTO faculty_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'course_id', OLD.course_id, 'faculty_id', OLD.faculty_id, 'enabled', OLD.enabled, 'version', OLD.version),json_object('id', NEW.id, 'course_id', NEW.course_id, 'faculty_id', NEW.faculty_id, 'enabled', NEW.enabled, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS faculty_audit_no_update BEFORE UPDATE ON faculty_audit BEGIN SELECT RAISE(ABORT,'Faculty audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS faculty_audit_no_delete BEFORE DELETE ON faculty_audit BEGIN SELECT RAISE(ABORT,'Faculty audit is append-only'); END;
