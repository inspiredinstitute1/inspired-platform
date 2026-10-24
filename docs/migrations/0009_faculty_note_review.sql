-- Separate opt-in authoring permission; existing teaching grants remain read-only.
CREATE TABLE IF NOT EXISTS faculty_note_access (
 assignment_id TEXT PRIMARY KEY REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS faculty_note_access_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 assignment_id TEXT NOT NULL REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS note_access_identity BEFORE UPDATE ON faculty_note_access WHEN OLD.assignment_id!=NEW.assignment_id
 BEGIN SELECT RAISE(ABORT,'Submission access identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS note_access_no_delete BEFORE DELETE ON faculty_note_access
 BEGIN SELECT RAISE(ABORT,'Disable submission access instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS note_access_insert AFTER INSERT ON faculty_note_access BEGIN
 INSERT INTO faculty_note_access_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.assignment_id,NEW.changed_by,NEW.change_reason,NULL,json_object('enabled',NEW.enabled,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS note_access_update AFTER UPDATE ON faculty_note_access BEGIN
 INSERT INTO faculty_note_access_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.assignment_id,NEW.changed_by,NEW.change_reason,json_object('enabled',OLD.enabled,'version',OLD.version),json_object('enabled',NEW.enabled,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS note_access_audit_no_update BEFORE UPDATE ON faculty_note_access_audit BEGIN SELECT RAISE(ABORT,'Submission access audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS note_access_audit_no_delete BEFORE DELETE ON faculty_note_access_audit BEGIN SELECT RAISE(ABORT,'Submission access audit is append-only'); END;

CREATE TABLE IF NOT EXISTS faculty_note_proposals (
 id TEXT PRIMARY KEY,
 course_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 author_id TEXT NOT NULL REFERENCES learner_progress(user_id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 20000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','accepted','rejected')),
 review_note TEXT NOT NULL DEFAULT '' CHECK(length(review_note)<=300),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_note_proposals_owner ON faculty_note_proposals(author_id,course_id,status,updated_at);
CREATE TABLE IF NOT EXISTS faculty_note_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 proposal_id TEXT NOT NULL REFERENCES faculty_note_proposals(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS note_proposal_insert_guard BEFORE INSERT ON faculty_note_proposals
 WHEN NEW.status!='draft' OR NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Create course note proposals as drafts'); END;
CREATE TRIGGER IF NOT EXISTS note_proposal_update_guard BEFORE UPDATE ON faculty_note_proposals
 WHEN OLD.id!=NEW.id OR OLD.course_id!=NEW.course_id OR OLD.author_id!=NEW.author_id
 OR OLD.status IN ('accepted','rejected')
 OR (OLD.status='draft' AND NEW.status NOT IN ('draft','submitted'))
 OR (OLD.status='submitted' AND (NEW.status NOT IN ('draft','accepted','rejected') OR OLD.title!=NEW.title OR OLD.category!=NEW.category OR OLD.body!=NEW.body))
 BEGIN SELECT RAISE(ABORT,'Invalid proposal transition or identity change'); END;
CREATE TRIGGER IF NOT EXISTS note_proposal_no_delete BEFORE DELETE ON faculty_note_proposals
 BEGIN SELECT RAISE(ABORT,'Retain proposal history instead of deleting'); END;
-- Acceptance creates a separate Admin draft and hidden course association atomically.
-- No faculty permission can publish it or modify the accepted snapshot.
CREATE TRIGGER IF NOT EXISTS note_proposal_accept AFTER UPDATE ON faculty_note_proposals
 WHEN NEW.status='accepted' AND OLD.status='submitted' BEGIN
 INSERT INTO authored_materials(id,title,category,body,status,changed_by,change_reason,updated_at)
 VALUES('authored-'||NEW.id,NEW.title,NEW.category,NEW.body,'draft',NEW.changed_by,NEW.change_reason,NEW.updated_at);
 INSERT INTO programme_resources(id,node_id,resource_kind,resource_id,enabled,changed_by,change_reason,updated_at)
 VALUES(NEW.id,NEW.course_id,'note','authored-'||NEW.id,0,NEW.changed_by,NEW.change_reason,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_insert AFTER INSERT ON faculty_note_proposals BEGIN
 INSERT INTO faculty_note_audit(proposal_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('course_id',NEW.course_id,'author_id',NEW.author_id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'review_note',NEW.review_note,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_update AFTER UPDATE ON faculty_note_proposals BEGIN
 INSERT INTO faculty_note_audit(proposal_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('course_id',OLD.course_id,'author_id',OLD.author_id,'title',OLD.title,'category',OLD.category,'body',OLD.body,'status',OLD.status,'review_note',OLD.review_note,'version',OLD.version),json_object('course_id',NEW.course_id,'author_id',NEW.author_id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'review_note',NEW.review_note,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_no_update BEFORE UPDATE ON faculty_note_audit BEGIN SELECT RAISE(ABORT,'Proposal audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_no_delete BEFORE DELETE ON faculty_note_audit BEGIN SELECT RAISE(ABORT,'Proposal audit is append-only'); END;
