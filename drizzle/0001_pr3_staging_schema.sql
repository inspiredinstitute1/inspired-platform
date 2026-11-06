-- STAGING-ONLY: fresh isolated Site, no learner/payment dataset.
-- Apply to the Sites D1 database in a controlled deployment only.
-- Never add unverified social URLs or private group member rosters to source control.
CREATE TABLE IF NOT EXISTS social_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL CHECK(platform IN ('youtube','whatsapp','telegram','instagram','facebook','website')),
 label TEXT NOT NULL,
 url TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 100,
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_social_links_order ON social_links(sort_order,id);
--> statement-breakpoint
-- Development migration, not applied to production.
CREATE TABLE IF NOT EXISTS community_groups (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL CHECK(platform IN ('whatsapp','telegram','website')),
 title TEXT NOT NULL,
 programme TEXT NOT NULL DEFAULT '',
 access_tier TEXT NOT NULL CHECK(access_tier IN ('free','premium_course','mock_only')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS community_memberships (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 group_id INTEGER NOT NULL REFERENCES community_groups(id),
 learner_id TEXT NOT NULL,
 membership_status TEXT NOT NULL CHECK(membership_status IN ('pending','confirmed','left','review')),
 payment_status TEXT NOT NULL CHECK(payment_status IN ('free','paid_active','pending_verification','expired','refund_review','mock_only','manual_exception')),
 verified_at INTEGER,
 updated_at INTEGER NOT NULL,
 UNIQUE(group_id,learner_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_community_group ON community_memberships(group_id,membership_status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_community_student ON community_memberships(learner_id);
--> statement-breakpoint
-- Development only; do not run against production without verified backup.
CREATE TABLE IF NOT EXISTS finance_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 source TEXT NOT NULL CHECK(source IN ('appx','phonepe','upi','cash','bank','other')),
 external_reference TEXT NOT NULL,
 student_id TEXT,
 course_code TEXT NOT NULL DEFAULT '',
 transaction_kind TEXT NOT NULL CHECK(transaction_kind IN ('tuition','mock_test','activation','refund','adjustment','other')),
 gross_paise INTEGER NOT NULL CHECK(gross_paise>=0),
 fee_paise INTEGER NOT NULL DEFAULT 0 CHECK(fee_paise>=0),
 net_paise INTEGER NOT NULL CHECK(net_paise>=0),
 paid_at TEXT NOT NULL,
 verification TEXT NOT NULL DEFAULT 'unverified' CHECK(verification IN ('unverified','verified','disputed')),
 linked_tuition_id INTEGER REFERENCES finance_transactions(id),
 imported_at INTEGER NOT NULL,
 UNIQUE(source,external_reference)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_student ON finance_transactions(student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(paid_at);
--> statement-breakpoint
-- Development only. Archive records; never delete programmes or learning history.
CREATE TABLE IF NOT EXISTS content_nodes (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('division','course','subject','module','test_series','test')),
 parent_id TEXT REFERENCES content_nodes(id) ON DELETE RESTRICT,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','paused','archived')),
 sort_order INTEGER NOT NULL DEFAULT 100 CHECK(sort_order BETWEEN 0 AND 9999),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_parent_order ON content_nodes(parent_id,sort_order,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS content_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 node_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_content_audit_node ON content_audit(node_id,id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_validate_insert BEFORE INSERT ON content_nodes BEGIN
 SELECT CASE WHEN NOT (
  (NEW.kind='division' AND NEW.parent_id IS NULL) OR
  EXISTS(SELECT 1 FROM content_nodes p WHERE p.id=NEW.parent_id AND (
   (NEW.kind='course' AND p.kind='division') OR
   (NEW.kind='subject' AND p.kind='course') OR
   (NEW.kind='module' AND p.kind='subject') OR
   (NEW.kind='test_series' AND p.kind IN ('course','subject')) OR
   (NEW.kind='test' AND p.kind IN ('module','test_series'))
  ))
 ) THEN RAISE(ABORT,'Invalid programme hierarchy') END;
 SELECT CASE WHEN NEW.status='published' AND EXISTS (
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_id,status FROM content_nodes WHERE id=NEW.parent_id
   UNION ALL SELECT p.id,p.parent_id,p.status FROM content_nodes p JOIN ancestors a ON p.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE status!='published'
 ) THEN RAISE(ABORT,'Publish parent programmes first') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_validate_update BEFORE UPDATE ON content_nodes BEGIN
 SELECT CASE WHEN NOT (
  (NEW.kind='division' AND NEW.parent_id IS NULL) OR
  EXISTS(SELECT 1 FROM content_nodes p WHERE p.id=NEW.parent_id AND (
   (NEW.kind='course' AND p.kind='division') OR
   (NEW.kind='subject' AND p.kind='course') OR
   (NEW.kind='module' AND p.kind='subject') OR
   (NEW.kind='test_series' AND p.kind IN ('course','subject')) OR
   (NEW.kind='test' AND p.kind IN ('module','test_series'))
  ))
 ) THEN RAISE(ABORT,'Invalid programme hierarchy') END;
 SELECT CASE WHEN NEW.status='published' AND EXISTS (
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_id,status FROM content_nodes WHERE id=NEW.parent_id
   UNION ALL SELECT p.id,p.parent_id,p.status FROM content_nodes p JOIN ancestors a ON p.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE status!='published'
 ) THEN RAISE(ABORT,'Publish parent programmes first') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_kind_immutable BEFORE UPDATE ON content_nodes
 WHEN OLD.kind!=NEW.kind BEGIN SELECT RAISE(ABORT,'Programme kind cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_no_delete BEFORE DELETE ON content_nodes
 BEGIN SELECT RAISE(ABORT,'Archive programme records instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_audit_insert AFTER INSERT ON content_nodes BEGIN
 INSERT INTO content_audit(node_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'kind', NEW.kind, 'parent_id', NEW.parent_id, 'title', NEW.title, 'description', NEW.description, 'status', NEW.status, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_audit_update AFTER UPDATE ON content_nodes BEGIN
 INSERT INTO content_audit(node_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'kind', OLD.kind, 'parent_id', OLD.parent_id, 'title', OLD.title, 'description', OLD.description, 'status', OLD.status, 'sort_order', OLD.sort_order, 'version', OLD.version),json_object('id', NEW.id, 'kind', NEW.kind, 'parent_id', NEW.parent_id, 'title', NEW.title, 'description', NEW.description, 'status', NEW.status, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_audit_no_update BEFORE UPDATE ON content_audit BEGIN SELECT RAISE(ABORT,'Programme audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS content_audit_no_delete BEFORE DELETE ON content_audit BEGIN SELECT RAISE(ABORT,'Programme audit is append-only'); END;
--> statement-breakpoint
-- Development only. Disabling a programme link retains its resource and audit history.
CREATE TABLE IF NOT EXISTS programme_resources (
 id TEXT PRIMARY KEY,
 node_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 resource_kind TEXT NOT NULL CHECK(resource_kind IN ('note','video','test')),
 resource_id TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 100 CHECK(sort_order BETWEEN 0 AND 9999),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 UNIQUE(node_id,resource_kind,resource_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_programme_resource_order ON programme_resources(node_id,sort_order,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS resource_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 link_id TEXT NOT NULL REFERENCES programme_resources(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_identity_immutable BEFORE UPDATE ON programme_resources
 WHEN OLD.node_id!=NEW.node_id OR OLD.resource_kind!=NEW.resource_kind OR OLD.resource_id!=NEW.resource_id
 BEGIN SELECT RAISE(ABORT,'Resource link identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_no_delete BEFORE DELETE ON programme_resources
 BEGIN SELECT RAISE(ABORT,'Disable resource links instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_audit_insert AFTER INSERT ON programme_resources BEGIN
 INSERT INTO resource_audit(link_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'node_id', NEW.node_id, 'resource_kind', NEW.resource_kind, 'resource_id', NEW.resource_id, 'enabled', NEW.enabled, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_audit_update AFTER UPDATE ON programme_resources BEGIN
 INSERT INTO resource_audit(link_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'node_id', OLD.node_id, 'resource_kind', OLD.resource_kind, 'resource_id', OLD.resource_id, 'enabled', OLD.enabled, 'sort_order', OLD.sort_order, 'version', OLD.version),json_object('id', NEW.id, 'node_id', NEW.node_id, 'resource_kind', NEW.resource_kind, 'resource_id', NEW.resource_id, 'enabled', NEW.enabled, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_audit_no_update BEFORE UPDATE ON resource_audit BEGIN SELECT RAISE(ABORT,'Resource audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS resource_audit_no_delete BEFORE DELETE ON resource_audit BEGIN SELECT RAISE(ABORT,'Resource audit is append-only'); END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_enrolments_learner ON programme_enrolments(learner_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS enrolment_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 enrolment_id TEXT NOT NULL REFERENCES programme_enrolments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_kind_insert BEFORE INSERT ON programme_enrolments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series'))
 BEGIN SELECT RAISE(ABORT,'Enrol only in courses or test series'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_kind_update BEFORE UPDATE ON programme_enrolments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series'))
 BEGIN SELECT RAISE(ABORT,'Enrol only in courses or test series'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_identity_immutable BEFORE UPDATE ON programme_enrolments
 WHEN OLD.node_id!=NEW.node_id OR OLD.learner_id!=NEW.learner_id
 BEGIN SELECT RAISE(ABORT,'Enrolment identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_no_delete BEFORE DELETE ON programme_enrolments
 BEGIN SELECT RAISE(ABORT,'Revoke enrolments instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_audit_insert AFTER INSERT ON programme_enrolments BEGIN
 INSERT INTO enrolment_audit(enrolment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'node_id', NEW.node_id, 'learner_id', NEW.learner_id, 'status', NEW.status, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_audit_update AFTER UPDATE ON programme_enrolments BEGIN
 INSERT INTO enrolment_audit(enrolment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'node_id', OLD.node_id, 'learner_id', OLD.learner_id, 'status', OLD.status, 'starts_at', OLD.starts_at, 'ends_at', OLD.ends_at, 'version', OLD.version),json_object('id', NEW.id, 'node_id', NEW.node_id, 'learner_id', NEW.learner_id, 'status', NEW.status, 'starts_at', NEW.starts_at, 'ends_at', NEW.ends_at, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_audit_no_update BEFORE UPDATE ON enrolment_audit BEGIN SELECT RAISE(ABORT,'Enrolment audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS enrolment_audit_no_delete BEFORE DELETE ON enrolment_audit BEGIN SELECT RAISE(ABORT,'Enrolment audit is append-only'); END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_faculty_assignments_account ON faculty_assignments(faculty_id,enabled);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS faculty_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 assignment_id TEXT NOT NULL REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_course_insert BEFORE INSERT ON faculty_assignments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Assign faculty only to courses'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_course_update BEFORE UPDATE ON faculty_assignments
 WHEN NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Assign faculty only to courses'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_identity_immutable BEFORE UPDATE ON faculty_assignments
 WHEN OLD.course_id!=NEW.course_id OR OLD.faculty_id!=NEW.faculty_id
 BEGIN SELECT RAISE(ABORT,'Faculty assignment identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_no_delete BEFORE DELETE ON faculty_assignments
 BEGIN SELECT RAISE(ABORT,'Disable faculty assignments instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_audit_insert AFTER INSERT ON faculty_assignments BEGIN
 INSERT INTO faculty_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'course_id', NEW.course_id, 'faculty_id', NEW.faculty_id, 'enabled', NEW.enabled, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_audit_update AFTER UPDATE ON faculty_assignments BEGIN
 INSERT INTO faculty_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'course_id', OLD.course_id, 'faculty_id', OLD.faculty_id, 'enabled', OLD.enabled, 'version', OLD.version),json_object('id', NEW.id, 'course_id', NEW.course_id, 'faculty_id', NEW.faculty_id, 'enabled', NEW.enabled, 'version', NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_audit_no_update BEFORE UPDATE ON faculty_audit BEGIN SELECT RAISE(ABORT,'Faculty audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS faculty_audit_no_delete BEFORE DELETE ON faculty_audit BEGIN SELECT RAISE(ABORT,'Faculty audit is append-only'); END;
--> statement-breakpoint
-- Plain-text free study notes. Archive instead of deleting; no live migration.
CREATE TABLE IF NOT EXISTS authored_materials (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 20000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_authored_status ON authored_materials(status,updated_at,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS material_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 material_id TEXT NOT NULL REFERENCES authored_materials(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_identity_immutable BEFORE UPDATE ON authored_materials WHEN OLD.id!=NEW.id
 BEGIN SELECT RAISE(ABORT,'Material identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_no_delete BEFORE DELETE ON authored_materials
 BEGIN SELECT RAISE(ABORT,'Archive materials instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_audit_insert AFTER INSERT ON authored_materials BEGIN
 INSERT INTO material_audit(material_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id',NEW.id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_audit_update AFTER UPDATE ON authored_materials BEGIN
 INSERT INTO material_audit(material_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id',OLD.id,'title',OLD.title,'category',OLD.category,'body',OLD.body,'status',OLD.status,'version',OLD.version),json_object('id',NEW.id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_audit_no_update BEFORE UPDATE ON material_audit BEGIN SELECT RAISE(ABORT,'Material audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS material_audit_no_delete BEFORE DELETE ON material_audit BEGIN SELECT RAISE(ABORT,'Material audit is append-only'); END;
--> statement-breakpoint
-- Separate opt-in authoring permission; existing teaching grants remain read-only.
CREATE TABLE IF NOT EXISTS faculty_note_access (
 assignment_id TEXT PRIMARY KEY REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS faculty_note_access_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 assignment_id TEXT NOT NULL REFERENCES faculty_assignments(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_identity BEFORE UPDATE ON faculty_note_access WHEN OLD.assignment_id!=NEW.assignment_id
 BEGIN SELECT RAISE(ABORT,'Submission access identity cannot change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_no_delete BEFORE DELETE ON faculty_note_access
 BEGIN SELECT RAISE(ABORT,'Disable submission access instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_insert AFTER INSERT ON faculty_note_access BEGIN
 INSERT INTO faculty_note_access_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.assignment_id,NEW.changed_by,NEW.change_reason,NULL,json_object('enabled',NEW.enabled,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_update AFTER UPDATE ON faculty_note_access BEGIN
 INSERT INTO faculty_note_access_audit(assignment_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.assignment_id,NEW.changed_by,NEW.change_reason,json_object('enabled',OLD.enabled,'version',OLD.version),json_object('enabled',NEW.enabled,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_audit_no_update BEFORE UPDATE ON faculty_note_access_audit BEGIN SELECT RAISE(ABORT,'Submission access audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_access_audit_no_delete BEFORE DELETE ON faculty_note_access_audit BEGIN SELECT RAISE(ABORT,'Submission access audit is append-only'); END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_note_proposals_owner ON faculty_note_proposals(author_id,course_id,status,updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS faculty_note_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 proposal_id TEXT NOT NULL REFERENCES faculty_note_proposals(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_insert_guard BEFORE INSERT ON faculty_note_proposals
 WHEN NEW.status!='draft' OR NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.course_id AND kind='course')
 BEGIN SELECT RAISE(ABORT,'Create course note proposals as drafts'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_update_guard BEFORE UPDATE ON faculty_note_proposals
 WHEN OLD.id!=NEW.id OR OLD.course_id!=NEW.course_id OR OLD.author_id!=NEW.author_id
 OR OLD.status IN ('accepted','rejected')
 OR (OLD.status='draft' AND NEW.status NOT IN ('draft','submitted'))
 OR (OLD.status='submitted' AND (NEW.status NOT IN ('draft','accepted','rejected') OR OLD.title!=NEW.title OR OLD.category!=NEW.category OR OLD.body!=NEW.body))
 BEGIN SELECT RAISE(ABORT,'Invalid proposal transition or identity change'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_no_delete BEFORE DELETE ON faculty_note_proposals
 BEGIN SELECT RAISE(ABORT,'Retain proposal history instead of deleting'); END;
--> statement-breakpoint
-- Acceptance creates a separate Admin draft and hidden course association atomically.
-- No faculty permission can publish it or modify the accepted snapshot.
CREATE TRIGGER IF NOT EXISTS note_proposal_accept AFTER UPDATE ON faculty_note_proposals
 WHEN NEW.status='accepted' AND OLD.status='submitted' BEGIN
 INSERT INTO authored_materials(id,title,category,body,status,changed_by,change_reason,updated_at)
 VALUES('authored-'||NEW.id,NEW.title,NEW.category,NEW.body,'draft',NEW.changed_by,NEW.change_reason,NEW.updated_at);
 INSERT INTO programme_resources(id,node_id,resource_kind,resource_id,enabled,changed_by,change_reason,updated_at)
 VALUES(NEW.id,NEW.course_id,'note','authored-'||NEW.id,0,NEW.changed_by,NEW.change_reason,NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_insert AFTER INSERT ON faculty_note_proposals BEGIN
 INSERT INTO faculty_note_audit(proposal_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('course_id',NEW.course_id,'author_id',NEW.author_id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'review_note',NEW.review_note,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_update AFTER UPDATE ON faculty_note_proposals BEGIN
 INSERT INTO faculty_note_audit(proposal_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('course_id',OLD.course_id,'author_id',OLD.author_id,'title',OLD.title,'category',OLD.category,'body',OLD.body,'status',OLD.status,'review_note',OLD.review_note,'version',OLD.version),json_object('course_id',NEW.course_id,'author_id',NEW.author_id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'review_note',NEW.review_note,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_no_update BEFORE UPDATE ON faculty_note_audit BEGIN SELECT RAISE(ABORT,'Proposal audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS note_proposal_audit_no_delete BEFORE DELETE ON faculty_note_audit BEGIN SELECT RAISE(ABORT,'Proposal audit is append-only'); END;
--> statement-breakpoint
-- Private immutable R2 objects, explicitly published metadata, retained history.
CREATE TABLE IF NOT EXISTS pdf_materials (
 id TEXT PRIMARY KEY,
 object_key TEXT NOT NULL UNIQUE,
 file_name TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 32 AND 5242880),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 60),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published','archived')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_pdf_materials_status ON pdf_materials(status,updated_at,id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS pdf_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 file_id TEXT NOT NULL REFERENCES pdf_materials(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_identity_immutable BEFORE UPDATE ON pdf_materials
 WHEN OLD.id!=NEW.id OR OLD.object_key!=NEW.object_key OR OLD.file_name!=NEW.file_name OR OLD.bytes!=NEW.bytes OR OLD.sha256!=NEW.sha256
 BEGIN SELECT RAISE(ABORT,'PDF file identity is immutable; upload a new draft'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_no_delete BEFORE DELETE ON pdf_materials
 BEGIN SELECT RAISE(ABORT,'Archive PDFs instead of deleting'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_audit_insert AFTER INSERT ON pdf_materials BEGIN
 INSERT INTO pdf_audit(file_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id',NEW.id,'object_key',NEW.object_key,'file_name',NEW.file_name,'bytes',NEW.bytes,'sha256',NEW.sha256,'title',NEW.title,'category',NEW.category,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_audit_update AFTER UPDATE ON pdf_materials BEGIN
 INSERT INTO pdf_audit(file_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id',OLD.id,'object_key',OLD.object_key,'file_name',OLD.file_name,'bytes',OLD.bytes,'sha256',OLD.sha256,'title',OLD.title,'category',OLD.category,'status',OLD.status,'version',OLD.version),json_object('id',NEW.id,'object_key',NEW.object_key,'file_name',NEW.file_name,'bytes',NEW.bytes,'sha256',NEW.sha256,'title',NEW.title,'category',NEW.category,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_audit_no_update BEFORE UPDATE ON pdf_audit BEGIN SELECT RAISE(ABORT,'PDF audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS pdf_audit_no_delete BEFORE DELETE ON pdf_audit BEGIN SELECT RAISE(ABORT,'PDF audit is append-only'); END;
--> statement-breakpoint
-- Imported records remain unverified and separate from finance_transactions.
CREATE TABLE IF NOT EXISTS finance_import_batches (
 id TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 source_label TEXT NOT NULL CHECK(length(trim(source_label)) BETWEEN 3 AND 120),
 imported_by TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),
 total_rows INTEGER NOT NULL CHECK(total_rows BETWEEN 1 AND 200),
 accepted_rows INTEGER NOT NULL CHECK(accepted_rows>=0),
 duplicate_rows INTEGER NOT NULL CHECK(duplicate_rows>=0),
 rejected_rows INTEGER NOT NULL CHECK(rejected_rows>=0),
 created_at INTEGER NOT NULL,
 CHECK(total_rows=accepted_rows+duplicate_rows+rejected_rows)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_import_rows (
 id TEXT PRIMARY KEY,
 batch_id TEXT NOT NULL REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
 row_number INTEGER NOT NULL CHECK(row_number BETWEEN 1 AND 200),
 verdict TEXT NOT NULL CHECK(verdict IN ('accepted','duplicate','rejected')),
 source TEXT,
 external_reference TEXT,
 transaction_json TEXT,
 raw_json TEXT NOT NULL,
 flags_json TEXT NOT NULL,
 issue TEXT NOT NULL DEFAULT '',
 CHECK(json_valid(raw_json) AND json_valid(flags_json)),
 CHECK((verdict='rejected' AND transaction_json IS NULL AND source IS NULL AND external_reference IS NULL) OR (verdict IN ('accepted','duplicate') AND source IS NOT NULL AND external_reference IS NOT NULL AND source IN ('appx','phonepe','upi','cash','bank','other') AND length(trim(external_reference))>0 AND transaction_json IS NOT NULL AND json_valid(transaction_json))),
 UNIQUE(batch_id,row_number)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_staged_reference ON finance_import_rows(source,external_reference) WHERE verdict='accepted';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_import_batch_rows ON finance_import_rows(batch_id,row_number);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_import_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 batch_id TEXT NOT NULL REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,snapshot_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_batch_audit AFTER INSERT ON finance_import_batches BEGIN
 INSERT INTO finance_import_audit(batch_id,actor_id,reason,snapshot_json,changed_at)
 VALUES(NEW.id,NEW.imported_by,NEW.reason,json_object('request_hash',NEW.request_hash,'source_label',NEW.source_label,'total_rows',NEW.total_rows,'accepted_rows',NEW.accepted_rows,'duplicate_rows',NEW.duplicate_rows,'rejected_rows',NEW.rejected_rows),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_batch_no_update BEFORE UPDATE ON finance_import_batches BEGIN SELECT RAISE(ABORT,'Import batches are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_batch_no_delete BEFORE DELETE ON finance_import_batches BEGIN SELECT RAISE(ABORT,'Retain import batches'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_row_no_update BEFORE UPDATE ON finance_import_rows BEGIN SELECT RAISE(ABORT,'Import rows are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_row_no_delete BEFORE DELETE ON finance_import_rows BEGIN SELECT RAISE(ABORT,'Retain import rows'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_audit_no_update BEFORE UPDATE ON finance_import_audit BEGIN SELECT RAISE(ABORT,'Import audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_audit_no_delete BEFORE DELETE ON finance_import_audit BEGIN SELECT RAISE(ABORT,'Import audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_import_row_count_guard BEFORE INSERT ON finance_import_rows
 WHEN NEW.row_number>(SELECT total_rows FROM finance_import_batches WHERE id=NEW.batch_id)
 OR (SELECT COUNT(*) FROM finance_import_rows WHERE batch_id=NEW.batch_id AND verdict=NEW.verdict)>=(SELECT CASE NEW.verdict WHEN 'accepted' THEN accepted_rows WHEN 'duplicate' THEN duplicate_rows ELSE rejected_rows END FROM finance_import_batches WHERE id=NEW.batch_id)
 BEGIN SELECT RAISE(ABORT,'Import row exceeds immutable batch counts'); END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_review_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 row_id TEXT NOT NULL REFERENCES finance_reviews(row_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_guard_insert BEFORE INSERT ON finance_reviews
 WHEN NOT EXISTS(SELECT 1 FROM finance_import_rows WHERE id=NEW.row_id AND verdict='accepted')
 OR (NEW.node_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series')))
 BEGIN SELECT RAISE(ABORT,'Review accepted rows and saved programmes only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_audit_insert AFTER INSERT ON finance_reviews BEGIN
 INSERT INTO finance_review_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,NULL,json_object('row_id',NEW.row_id,'learner_id',NEW.learner_id,'node_id',NEW.node_id,'status',NEW.status,'evidence_reference',NEW.evidence_reference,'evidence_notes',NEW.evidence_notes,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_guard_update BEFORE UPDATE ON finance_reviews
 WHEN NOT EXISTS(SELECT 1 FROM finance_import_rows WHERE id=NEW.row_id AND verdict='accepted')
 OR (NEW.node_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_nodes WHERE id=NEW.node_id AND kind IN ('course','test_series')))
 BEGIN SELECT RAISE(ABORT,'Review accepted rows and saved programmes only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_audit_update AFTER UPDATE ON finance_reviews BEGIN
 INSERT INTO finance_review_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,json_object('row_id',OLD.row_id,'learner_id',OLD.learner_id,'node_id',OLD.node_id,'status',OLD.status,'evidence_reference',OLD.evidence_reference,'evidence_notes',OLD.evidence_notes,'version',OLD.version),json_object('row_id',NEW.row_id,'learner_id',NEW.learner_id,'node_id',NEW.node_id,'status',NEW.status,'evidence_reference',NEW.evidence_reference,'evidence_notes',NEW.evidence_notes,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_identity BEFORE UPDATE ON finance_reviews WHEN OLD.row_id!=NEW.row_id BEGIN SELECT RAISE(ABORT,'Review row identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_no_delete BEFORE DELETE ON finance_reviews BEGIN SELECT RAISE(ABORT,'Retain payment reviews'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_audit_no_update BEFORE UPDATE ON finance_review_audit BEGIN SELECT RAISE(ABORT,'Review audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_review_audit_no_delete BEFORE DELETE ON finance_review_audit BEGIN SELECT RAISE(ABORT,'Review audit is append-only'); END;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_evidence_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 row_id TEXT NOT NULL REFERENCES finance_evidence_decisions(row_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_evidence_audit_row ON finance_evidence_audit(row_id,id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_guard_insert BEFORE INSERT ON finance_evidence_decisions
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews r JOIN finance_import_rows f ON f.id=r.row_id WHERE r.row_id=NEW.row_id AND r.version=NEW.review_version AND f.verdict='accepted' AND NEW.snapshot_json=json_object('rowId',r.row_id,'reviewVersion',r.version,'learnerId',r.learner_id,'nodeId',r.node_id,'reviewStatus',r.status,'evidenceReference',r.evidence_reference,'evidenceNotes',r.evidence_notes,'transaction',json(f.transaction_json)) AND (NEW.status!='confirmed' OR r.status='reviewed'))
 BEGIN SELECT RAISE(ABORT,'Evidence decision requires the current saved review snapshot'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_insert AFTER INSERT ON finance_evidence_decisions BEGIN
 INSERT INTO finance_evidence_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,NULL,json_object('row_id',NEW.row_id,'review_version',NEW.review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'method',NEW.method,'attested',NEW.attested,'notes',NEW.notes,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_guard_update BEFORE UPDATE ON finance_evidence_decisions
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews r JOIN finance_import_rows f ON f.id=r.row_id WHERE r.row_id=NEW.row_id AND r.version=NEW.review_version AND f.verdict='accepted' AND NEW.snapshot_json=json_object('rowId',r.row_id,'reviewVersion',r.version,'learnerId',r.learner_id,'nodeId',r.node_id,'reviewStatus',r.status,'evidenceReference',r.evidence_reference,'evidenceNotes',r.evidence_notes,'transaction',json(f.transaction_json)) AND (NEW.status!='confirmed' OR r.status='reviewed'))
 BEGIN SELECT RAISE(ABORT,'Evidence decision requires the current saved review snapshot'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_update AFTER UPDATE ON finance_evidence_decisions BEGIN
 INSERT INTO finance_evidence_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,json_object('row_id',OLD.row_id,'review_version',OLD.review_version,'snapshot_json',OLD.snapshot_json,'status',OLD.status,'method',OLD.method,'attested',OLD.attested,'notes',OLD.notes,'version',OLD.version),json_object('row_id',NEW.row_id,'review_version',NEW.review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'method',NEW.method,'attested',NEW.attested,'notes',NEW.notes,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_identity BEFORE UPDATE ON finance_evidence_decisions WHEN OLD.row_id!=NEW.row_id BEGIN SELECT RAISE(ABORT,'Evidence row identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_version_insert BEFORE INSERT ON finance_evidence_decisions WHEN NEW.version!=1 BEGIN SELECT RAISE(ABORT,'Invalid evidence version'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_version_update BEFORE UPDATE ON finance_evidence_decisions WHEN NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Invalid evidence version'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_no_delete BEFORE DELETE ON finance_evidence_decisions BEGIN SELECT RAISE(ABORT,'Retain evidence decisions'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_no_update BEFORE UPDATE ON finance_evidence_audit BEGIN SELECT RAISE(ABORT,'Evidence audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_evidence_audit_no_delete BEFORE DELETE ON finance_evidence_audit BEGIN SELECT RAISE(ABORT,'Evidence audit is append-only'); END;
--> statement-breakpoint
-- Development only. Saved matches do not verify payments, post revenue or grant access.
CREATE TABLE IF NOT EXISTS finance_payment_links (
 row_id TEXT PRIMARY KEY REFERENCES finance_reviews(row_id) ON DELETE RESTRICT,
 target_row_id TEXT NOT NULL REFERENCES finance_reviews(row_id) ON DELETE RESTRICT,
 source_review_version INTEGER NOT NULL CHECK(source_review_version>=1),
 target_review_version INTEGER NOT NULL CHECK(target_review_version>=1),
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
 status TEXT NOT NULL CHECK(status IN ('active','revoked')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1),
 changed_by TEXT NOT NULL,
 change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),
 updated_at INTEGER NOT NULL,
 CHECK(row_id!=target_row_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_payment_link_target ON finance_payment_links(target_row_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_payment_link_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 row_id TEXT NOT NULL REFERENCES finance_payment_links(row_id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_payment_link_audit_row ON finance_payment_link_audit(row_id,id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_guard_insert BEFORE INSERT ON finance_payment_links
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews s JOIN finance_import_rows sf ON sf.id=s.row_id JOIN finance_reviews t ON t.row_id=NEW.target_row_id JOIN finance_import_rows tf ON tf.id=t.row_id WHERE s.row_id=NEW.row_id AND s.version=NEW.source_review_version AND t.version=NEW.target_review_version AND sf.verdict='accepted' AND tf.verdict='accepted' AND sf.batch_id=tf.batch_id AND NEW.snapshot_json=json_object('source',json_object('rowId',s.row_id,'reviewVersion',s.version,'learnerId',s.learner_id,'nodeId',s.node_id,'reviewStatus',s.status,'evidenceReference',s.evidence_reference,'evidenceNotes',s.evidence_notes,'transaction',json(sf.transaction_json)),'target',json_object('rowId',t.row_id,'reviewVersion',t.version,'learnerId',t.learner_id,'nodeId',t.node_id,'reviewStatus',t.status,'evidenceReference',t.evidence_reference,'evidenceNotes',t.evidence_notes,'transaction',json(tf.transaction_json))) AND (NEW.status='revoked' OR (s.status='reviewed' AND t.status='reviewed' AND s.learner_id=t.learner_id AND s.node_id=t.node_id
 AND json_extract(sf.transaction_json,'$.paidAt')>=json_extract(tf.transaction_json,'$.paidAt')
 AND ((json_extract(sf.transaction_json,'$.transactionKind')='activation' AND sf.source='appx' AND tf.source!='appx' AND json_extract(tf.transaction_json,'$.transactionKind')='tuition') OR (json_extract(sf.transaction_json,'$.transactionKind')='refund' AND json_extract(sf.transaction_json,'$.feePaise')=0 AND json_extract(tf.transaction_json,'$.transactionKind') IN ('tuition','mock_test')))
 AND NOT EXISTS(SELECT 1 FROM finance_transactions ledger WHERE (ledger.source=sf.source AND ledger.external_reference=sf.external_reference) OR (ledger.source=tf.source AND ledger.external_reference=tf.external_reference)))))
 BEGIN SELECT RAISE(ABORT,'Payment link snapshot or relationship is no longer valid'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_limits_insert BEFORE INSERT ON finance_payment_links WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN (SELECT json_extract(transaction_json,'$.transactionKind') FROM finance_import_rows WHERE id=NEW.row_id)='activation' AND EXISTS(SELECT 1 FROM finance_payment_links l JOIN finance_reviews ls ON ls.row_id=l.row_id AND ls.version=l.source_review_version AND ls.status='reviewed' JOIN finance_reviews lt ON lt.row_id=l.target_row_id AND lt.version=l.target_review_version AND lt.status='reviewed' JOIN finance_import_rows lf ON lf.id=l.row_id WHERE l.status='active' AND l.target_row_id=NEW.target_row_id AND l.row_id!=NEW.row_id AND json_extract(lf.transaction_json,'$.transactionKind')='activation') THEN RAISE(ABORT,'Payment link conflict: another current activation targets this tuition') END;
 SELECT CASE WHEN (SELECT json_extract(transaction_json,'$.transactionKind') FROM finance_import_rows WHERE id=NEW.row_id)='refund' AND (SELECT COALESCE(SUM(json_extract(lf.transaction_json,'$.grossPaise')),0) FROM finance_payment_links l JOIN finance_reviews ls ON ls.row_id=l.row_id AND ls.version=l.source_review_version AND ls.status='reviewed' JOIN finance_reviews lt ON lt.row_id=l.target_row_id AND lt.version=l.target_review_version AND lt.status='reviewed' JOIN finance_import_rows lf ON lf.id=l.row_id WHERE l.status='active' AND l.target_row_id=NEW.target_row_id AND l.row_id!=NEW.row_id AND json_extract(lf.transaction_json,'$.transactionKind')='refund')+(SELECT json_extract(transaction_json,'$.grossPaise') FROM finance_import_rows WHERE id=NEW.row_id)>(SELECT json_extract(transaction_json,'$.grossPaise') FROM finance_import_rows WHERE id=NEW.target_row_id) THEN RAISE(ABORT,'Payment link conflict: refunds exceed original gross') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_audit_insert AFTER INSERT ON finance_payment_links BEGIN
 INSERT INTO finance_payment_link_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,NULL,json_object('row_id',NEW.row_id,'target_row_id',NEW.target_row_id,'source_review_version',NEW.source_review_version,'target_review_version',NEW.target_review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_guard_update BEFORE UPDATE ON finance_payment_links
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews s JOIN finance_import_rows sf ON sf.id=s.row_id JOIN finance_reviews t ON t.row_id=NEW.target_row_id JOIN finance_import_rows tf ON tf.id=t.row_id WHERE s.row_id=NEW.row_id AND s.version=NEW.source_review_version AND t.version=NEW.target_review_version AND sf.verdict='accepted' AND tf.verdict='accepted' AND sf.batch_id=tf.batch_id AND NEW.snapshot_json=json_object('source',json_object('rowId',s.row_id,'reviewVersion',s.version,'learnerId',s.learner_id,'nodeId',s.node_id,'reviewStatus',s.status,'evidenceReference',s.evidence_reference,'evidenceNotes',s.evidence_notes,'transaction',json(sf.transaction_json)),'target',json_object('rowId',t.row_id,'reviewVersion',t.version,'learnerId',t.learner_id,'nodeId',t.node_id,'reviewStatus',t.status,'evidenceReference',t.evidence_reference,'evidenceNotes',t.evidence_notes,'transaction',json(tf.transaction_json))) AND (NEW.status='revoked' OR (s.status='reviewed' AND t.status='reviewed' AND s.learner_id=t.learner_id AND s.node_id=t.node_id
 AND json_extract(sf.transaction_json,'$.paidAt')>=json_extract(tf.transaction_json,'$.paidAt')
 AND ((json_extract(sf.transaction_json,'$.transactionKind')='activation' AND sf.source='appx' AND tf.source!='appx' AND json_extract(tf.transaction_json,'$.transactionKind')='tuition') OR (json_extract(sf.transaction_json,'$.transactionKind')='refund' AND json_extract(sf.transaction_json,'$.feePaise')=0 AND json_extract(tf.transaction_json,'$.transactionKind') IN ('tuition','mock_test')))
 AND NOT EXISTS(SELECT 1 FROM finance_transactions ledger WHERE (ledger.source=sf.source AND ledger.external_reference=sf.external_reference) OR (ledger.source=tf.source AND ledger.external_reference=tf.external_reference)))))
 BEGIN SELECT RAISE(ABORT,'Payment link snapshot or relationship is no longer valid'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_limits_update BEFORE UPDATE ON finance_payment_links WHEN NEW.status='active' BEGIN
 SELECT CASE WHEN (SELECT json_extract(transaction_json,'$.transactionKind') FROM finance_import_rows WHERE id=NEW.row_id)='activation' AND EXISTS(SELECT 1 FROM finance_payment_links l JOIN finance_reviews ls ON ls.row_id=l.row_id AND ls.version=l.source_review_version AND ls.status='reviewed' JOIN finance_reviews lt ON lt.row_id=l.target_row_id AND lt.version=l.target_review_version AND lt.status='reviewed' JOIN finance_import_rows lf ON lf.id=l.row_id WHERE l.status='active' AND l.target_row_id=NEW.target_row_id AND l.row_id!=NEW.row_id AND json_extract(lf.transaction_json,'$.transactionKind')='activation') THEN RAISE(ABORT,'Payment link conflict: another current activation targets this tuition') END;
 SELECT CASE WHEN (SELECT json_extract(transaction_json,'$.transactionKind') FROM finance_import_rows WHERE id=NEW.row_id)='refund' AND (SELECT COALESCE(SUM(json_extract(lf.transaction_json,'$.grossPaise')),0) FROM finance_payment_links l JOIN finance_reviews ls ON ls.row_id=l.row_id AND ls.version=l.source_review_version AND ls.status='reviewed' JOIN finance_reviews lt ON lt.row_id=l.target_row_id AND lt.version=l.target_review_version AND lt.status='reviewed' JOIN finance_import_rows lf ON lf.id=l.row_id WHERE l.status='active' AND l.target_row_id=NEW.target_row_id AND l.row_id!=NEW.row_id AND json_extract(lf.transaction_json,'$.transactionKind')='refund')+(SELECT json_extract(transaction_json,'$.grossPaise') FROM finance_import_rows WHERE id=NEW.row_id)>(SELECT json_extract(transaction_json,'$.grossPaise') FROM finance_import_rows WHERE id=NEW.target_row_id) THEN RAISE(ABORT,'Payment link conflict: refunds exceed original gross') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_audit_update AFTER UPDATE ON finance_payment_links BEGIN
 INSERT INTO finance_payment_link_audit(row_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.row_id,NEW.changed_by,NEW.change_reason,json_object('row_id',OLD.row_id,'target_row_id',OLD.target_row_id,'source_review_version',OLD.source_review_version,'target_review_version',OLD.target_review_version,'snapshot_json',OLD.snapshot_json,'status',OLD.status,'version',OLD.version),json_object('row_id',NEW.row_id,'target_row_id',NEW.target_row_id,'source_review_version',NEW.source_review_version,'target_review_version',NEW.target_review_version,'snapshot_json',NEW.snapshot_json,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_insert_version BEFORE INSERT ON finance_payment_links WHEN NEW.version!=1 OR NEW.status!='active' BEGIN SELECT RAISE(ABORT,'Create an active payment link at version one'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_update_version BEFORE UPDATE ON finance_payment_links WHEN NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Invalid payment link version'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_identity BEFORE UPDATE ON finance_payment_links WHEN OLD.row_id!=NEW.row_id OR (NEW.status='revoked' AND OLD.target_row_id!=NEW.target_row_id) BEGIN SELECT RAISE(ABORT,'Payment link row or revoked target identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_no_delete BEFORE DELETE ON finance_payment_links BEGIN SELECT RAISE(ABORT,'Retain payment links'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_audit_no_update BEFORE UPDATE ON finance_payment_link_audit BEGIN SELECT RAISE(ABORT,'Payment link audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_audit_no_delete BEFORE DELETE ON finance_payment_link_audit BEGIN SELECT RAISE(ABORT,'Payment link audit is append-only'); END;
--> statement-breakpoint
-- Development only: allow reviewed links across staged batches. Existing rows/audits are retained.
DROP TRIGGER IF EXISTS finance_payment_link_guard_insert;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_guard_insert BEFORE INSERT ON finance_payment_links
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews s JOIN finance_import_rows sf ON sf.id=s.row_id JOIN finance_reviews t ON t.row_id=NEW.target_row_id JOIN finance_import_rows tf ON tf.id=t.row_id WHERE s.row_id=NEW.row_id AND s.version=NEW.source_review_version AND t.version=NEW.target_review_version AND sf.verdict='accepted' AND tf.verdict='accepted' AND NEW.snapshot_json=json_object('source',json_object('rowId',s.row_id,'reviewVersion',s.version,'learnerId',s.learner_id,'nodeId',s.node_id,'reviewStatus',s.status,'evidenceReference',s.evidence_reference,'evidenceNotes',s.evidence_notes,'transaction',json(sf.transaction_json)),'target',json_object('rowId',t.row_id,'reviewVersion',t.version,'learnerId',t.learner_id,'nodeId',t.node_id,'reviewStatus',t.status,'evidenceReference',t.evidence_reference,'evidenceNotes',t.evidence_notes,'transaction',json(tf.transaction_json))) AND (NEW.status='revoked' OR (s.status='reviewed' AND t.status='reviewed' AND s.learner_id=t.learner_id AND s.node_id=t.node_id
 AND json_extract(sf.transaction_json,'$.paidAt')>=json_extract(tf.transaction_json,'$.paidAt')
 AND ((json_extract(sf.transaction_json,'$.transactionKind')='activation' AND sf.source='appx' AND tf.source!='appx' AND json_extract(tf.transaction_json,'$.transactionKind')='tuition') OR (json_extract(sf.transaction_json,'$.transactionKind')='refund' AND json_extract(sf.transaction_json,'$.feePaise')=0 AND json_extract(tf.transaction_json,'$.transactionKind') IN ('tuition','mock_test')))
 AND NOT EXISTS(SELECT 1 FROM finance_transactions ledger WHERE (ledger.source=sf.source AND ledger.external_reference=sf.external_reference) OR (ledger.source=tf.source AND ledger.external_reference=tf.external_reference)))))
 BEGIN SELECT RAISE(ABORT,'Payment link snapshot or relationship is no longer valid'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS finance_payment_link_guard_update;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_payment_link_guard_update BEFORE UPDATE ON finance_payment_links
 WHEN NOT EXISTS(SELECT 1 FROM finance_reviews s JOIN finance_import_rows sf ON sf.id=s.row_id JOIN finance_reviews t ON t.row_id=NEW.target_row_id JOIN finance_import_rows tf ON tf.id=t.row_id WHERE s.row_id=NEW.row_id AND s.version=NEW.source_review_version AND t.version=NEW.target_review_version AND sf.verdict='accepted' AND tf.verdict='accepted' AND NEW.snapshot_json=json_object('source',json_object('rowId',s.row_id,'reviewVersion',s.version,'learnerId',s.learner_id,'nodeId',s.node_id,'reviewStatus',s.status,'evidenceReference',s.evidence_reference,'evidenceNotes',s.evidence_notes,'transaction',json(sf.transaction_json)),'target',json_object('rowId',t.row_id,'reviewVersion',t.version,'learnerId',t.learner_id,'nodeId',t.node_id,'reviewStatus',t.status,'evidenceReference',t.evidence_reference,'evidenceNotes',t.evidence_notes,'transaction',json(tf.transaction_json))) AND (NEW.status='revoked' OR (s.status='reviewed' AND t.status='reviewed' AND s.learner_id=t.learner_id AND s.node_id=t.node_id
 AND json_extract(sf.transaction_json,'$.paidAt')>=json_extract(tf.transaction_json,'$.paidAt')
 AND ((json_extract(sf.transaction_json,'$.transactionKind')='activation' AND sf.source='appx' AND tf.source!='appx' AND json_extract(tf.transaction_json,'$.transactionKind')='tuition') OR (json_extract(sf.transaction_json,'$.transactionKind')='refund' AND json_extract(sf.transaction_json,'$.feePaise')=0 AND json_extract(tf.transaction_json,'$.transactionKind') IN ('tuition','mock_test')))
 AND NOT EXISTS(SELECT 1 FROM finance_transactions ledger WHERE (ledger.source=sf.source AND ledger.external_reference=sf.external_reference) OR (ledger.source=tf.source AND ledger.external_reference=tf.external_reference)))))
 BEGIN SELECT RAISE(ABORT,'Payment link snapshot or relationship is no longer valid'); END;
--> statement-breakpoint
-- Development only. Review approval is not payment verification or ledger posting.
CREATE TABLE IF NOT EXISTS finance_approval_state_versions (
 kind TEXT NOT NULL CHECK(kind IN ('identity','ledger')),
 entity_key TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>=1),
 PRIMARY KEY(kind,entity_key)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_approval_batch ON finance_approval_snapshots(batch_id,created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_finance_approval_scope ON finance_approval_snapshots(batch_id,scope_hash);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_approval_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 snapshot_id TEXT NOT NULL UNIQUE REFERENCES finance_approval_snapshots(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,scope_hash TEXT NOT NULL,decision TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_insert AFTER INSERT ON finance_approval_snapshots BEGIN
 INSERT INTO finance_approval_audit(snapshot_id,actor_id,reason,scope_hash,decision,changed_at) VALUES(NEW.id,NEW.actor_id,NEW.reason,NEW.scope_hash,NEW.decision,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_no_update BEFORE UPDATE ON finance_approval_snapshots BEGIN SELECT RAISE(ABORT,'Approval snapshots are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_no_delete BEFORE DELETE ON finance_approval_snapshots BEGIN SELECT RAISE(ABORT,'Retain approval snapshots'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_no_update BEFORE UPDATE ON finance_approval_audit BEGIN SELECT RAISE(ABORT,'Approval audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_audit_no_delete BEFORE DELETE ON finance_approval_audit BEGIN SELECT RAISE(ABORT,'Approval audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_state_no_delete BEFORE DELETE ON finance_approval_state_versions BEGIN SELECT RAISE(ABORT,'Retain approval change counters'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_state_monotonic BEFORE UPDATE ON finance_approval_state_versions WHEN NEW.kind!=OLD.kind OR NEW.entity_key!=OLD.entity_key OR NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Approval counters only advance'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_insert AFTER INSERT ON learner_progress BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',NEW.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_insert AFTER INSERT ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(NEW.source,NEW.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_update AFTER UPDATE ON learner_progress WHEN OLD.email IS NOT NEW.email OR OLD.display_name IS NOT NEW.display_name BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',NEW.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_update AFTER UPDATE ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(NEW.source,NEW.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; INSERT INTO finance_approval_state_versions(kind,entity_key,version) SELECT 'ledger',json_array(OLD.source,OLD.external_reference),1 WHERE OLD.source!=NEW.source OR OLD.external_reference!=NEW.external_reference ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_identity_delete AFTER DELETE ON learner_progress BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('identity',OLD.user_id,1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_approval_ledger_delete AFTER DELETE ON finance_transactions BEGIN INSERT INTO finance_approval_state_versions(kind,entity_key,version) VALUES('ledger',json_array(OLD.source,OLD.external_reference),1) ON CONFLICT(kind,entity_key) DO UPDATE SET version=version+1; END;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_rehearsal_original_row ON finance_rehearsal_entries(row_id) WHERE original_entry_id IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rehearsal_target ON finance_rehearsal_entries(target_row_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_rehearsal_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 operation_id TEXT NOT NULL UNIQUE REFERENCES finance_rehearsal_operations(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL,actor_id TEXT NOT NULL,reason TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_reverse_guard BEFORE INSERT ON finance_rehearsal_operations
 WHEN NEW.kind='reverse' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM finance_rehearsal_operations WHERE id=NEW.reverses_id AND kind='post') OR EXISTS(SELECT 1 FROM finance_rehearsal_operations WHERE reverses_id=NEW.reverses_id) THEN RAISE(ABORT,'Rehearsal conflict: original must be an unreversed post') END;
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM finance_rehearsal_entries child JOIN finance_rehearsal_entries parent ON parent.row_id=child.target_row_id
 WHERE parent.operation_id=NEW.reverses_id AND parent.original_entry_id IS NULL AND child.original_entry_id IS NULL AND child.operation_id!=NEW.reverses_id
 AND NOT EXISTS(SELECT 1 FROM finance_rehearsal_entries reversed WHERE reversed.original_entry_id=child.id)
 ) THEN RAISE(ABORT,'Rehearsal conflict: reverse dependent posts first') END;
END;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_operation_no_update BEFORE UPDATE ON finance_rehearsal_operations BEGIN SELECT RAISE(ABORT,'Rehearsal operations are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_operation_no_delete BEFORE DELETE ON finance_rehearsal_operations BEGIN SELECT RAISE(ABORT,'Retain rehearsal operations'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_entry_no_update BEFORE UPDATE ON finance_rehearsal_entries BEGIN SELECT RAISE(ABORT,'Rehearsal entries are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_entry_no_delete BEFORE DELETE ON finance_rehearsal_entries BEGIN SELECT RAISE(ABORT,'Retain rehearsal entries'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_audit_no_update BEFORE UPDATE ON finance_rehearsal_audit BEGIN SELECT RAISE(ABORT,'Rehearsal audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_rehearsal_audit_no_delete BEFORE DELETE ON finance_rehearsal_audit BEGIN SELECT RAISE(ABORT,'Retain rehearsal audit'); END;
--> statement-breakpoint
-- Development only. Pending verification requests are not authenticated provider evidence.
CREATE TABLE IF NOT EXISTS finance_verification_requests (
 id TEXT PRIMARY KEY,
 approval_id TEXT NOT NULL UNIQUE REFERENCES finance_approval_snapshots(id) ON DELETE RESTRICT,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 expected_json TEXT NOT NULL CHECK(json_valid(expected_json) AND length(CAST(expected_json AS BLOB))<=250000),
 actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_verification_events (
 id TEXT PRIMARY KEY,
 task_id TEXT NOT NULL REFERENCES finance_verification_requests(id) ON DELETE RESTRICT,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 status TEXT NOT NULL CHECK(status IN ('awaiting_provider','disputed','cancelled')),
 version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
 actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),changed_at INTEGER NOT NULL,
 UNIQUE(task_id,version)
);
--> statement-breakpoint
CREATE VIEW IF NOT EXISTS finance_verification_expected AS SELECT s.id AS approvalId,
 json_object('policy','independent-evidence-request-v1','requiredCurrency','INR','providerAuthenticated',json('false'),'items',json((
 SELECT json_group_array(json(item)) FROM (SELECT json_object('rowId',json_extract(r.value,'$.rowId'),'selected',json(CASE WHEN EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.selectedIds') x WHERE x.value=json_extract(r.value,'$.rowId')) THEN 'true' ELSE 'false' END),'transaction',json_extract(r.value,'$.transaction'),'learnerId',json_extract(r.value,'$.review.learnerId'),'nodeId',json_extract(r.value,'$.review.nodeId'),'reviewVersion',json_extract(r.value,'$.review.version'),'targetRowId',json_extract(r.value,'$.link.targetRowId')) AS item
 FROM json_each(s.scope_json,'$.rows') r WHERE EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.selectedIds') x WHERE x.value=json_extract(r.value,'$.rowId')) OR EXISTS(SELECT 1 FROM json_each(s.scope_json,'$.targetIds') x WHERE x.value=json_extract(r.value,'$.rowId')) ORDER BY json_extract(r.value,'$.rowId'))
 ))) AS expectedJson FROM finance_approval_snapshots s;
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_event_guard BEFORE INSERT ON finance_verification_events BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM finance_verification_requests q WHERE q.id=NEW.task_id AND NEW.version=1 AND NEW.status='awaiting_provider' AND NEW.id=q.id AND NEW.request_hash=q.request_hash AND NEW.actor_id=q.actor_id AND NEW.reason=q.reason AND NEW.changed_at=q.created_at
 UNION ALL
 SELECT 1 FROM finance_verification_events e WHERE e.task_id=NEW.task_id AND e.version=NEW.version-1 AND e.version=(SELECT MAX(version) FROM finance_verification_events WHERE task_id=NEW.task_id) AND ((e.status='awaiting_provider' AND NEW.status IN ('disputed','cancelled')) OR (e.status='disputed' AND NEW.status='cancelled'))
 ) THEN RAISE(ABORT,'Verification conflict: stale event version or invalid transition') END;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_requested AFTER INSERT ON finance_verification_requests BEGIN
 INSERT INTO finance_verification_events(id,task_id,request_hash,status,version,actor_id,reason,changed_at) VALUES(NEW.id,NEW.id,NEW.request_hash,'awaiting_provider',1,NEW.actor_id,NEW.reason,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_request_no_update BEFORE UPDATE ON finance_verification_requests BEGIN SELECT RAISE(ABORT,'Verification requests are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_request_no_delete BEFORE DELETE ON finance_verification_requests BEGIN SELECT RAISE(ABORT,'Retain verification requests'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_event_no_update BEFORE UPDATE ON finance_verification_events BEGIN SELECT RAISE(ABORT,'Verification events are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_verification_event_no_delete BEFORE DELETE ON finance_verification_events BEGIN SELECT RAISE(ABORT,'Retain verification events'); END;
--> statement-breakpoint
-- Development only. Section switches do not make free/public material private.
CREATE TABLE IF NOT EXISTS portal_modules (
 module_key TEXT PRIMARY KEY CHECK(module_key IN ('library','practice','videos','programmes','teaching','premium')),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 show_navigation INTEGER NOT NULL DEFAULT 1 CHECK(show_navigation IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
 changed_by TEXT NOT NULL,change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS portal_module_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,module_key TEXT NOT NULL REFERENCES portal_modules(module_key) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_insert_audit AFTER INSERT ON portal_modules BEGIN
 INSERT INTO portal_module_audit(module_key,actor_id,reason,previous_json,next_json,changed_at) VALUES(NEW.module_key,NEW.changed_by,NEW.change_reason,NULL,json_object('enabled',NEW.enabled,'showNavigation',NEW.show_navigation,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_update_guard BEFORE UPDATE ON portal_modules WHEN NEW.module_key!=OLD.module_key OR NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Module identity is fixed and versions must advance'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_update_audit AFTER UPDATE ON portal_modules BEGIN
 INSERT INTO portal_module_audit(module_key,actor_id,reason,previous_json,next_json,changed_at) VALUES(NEW.module_key,NEW.changed_by,NEW.change_reason,json_object('enabled',OLD.enabled,'showNavigation',OLD.show_navigation,'version',OLD.version),json_object('enabled',NEW.enabled,'showNavigation',NEW.show_navigation,'version',NEW.version),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_no_delete BEFORE DELETE ON portal_modules BEGIN SELECT RAISE(ABORT,'Retain module settings'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_audit_no_update BEFORE UPDATE ON portal_module_audit BEGIN SELECT RAISE(ABORT,'Module audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_module_audit_no_delete BEFORE DELETE ON portal_module_audit BEGIN SELECT RAISE(ABORT,'Retain module audit'); END;
--> statement-breakpoint
INSERT OR IGNORE INTO portal_modules(module_key,changed_by,change_reason,updated_at) VALUES('library','migration','Preserve existing section availability',0),('practice','migration','Preserve existing section availability',0),('videos','migration','Preserve existing section availability',0),('programmes','migration','Preserve existing section availability',0),('teaching','migration','Preserve existing section availability',0),('premium','migration','Preserve existing section availability',0);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_practice_insert_guard BEFORE INSERT ON learner_progress WHEN EXISTS(SELECT 1 FROM portal_modules WHERE module_key='practice' AND enabled=0) AND (COALESCE(json_array_length(NEW.payload,'$.attempts'),0)>0 OR COALESCE(json_extract(NEW.payload,'$.drafts'),'{}')!='{}') BEGIN SELECT RAISE(ABORT,'Practice is paused'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS portal_practice_update_guard BEFORE UPDATE OF payload ON learner_progress WHEN EXISTS(SELECT 1 FROM portal_modules WHERE module_key='practice' AND enabled=0) AND (COALESCE(json_extract(NEW.payload,'$.attempts'),'[]') IS NOT COALESCE(json_extract(OLD.payload,'$.attempts'),'[]') OR COALESCE(json_extract(NEW.payload,'$.drafts'),'{}') IS NOT COALESCE(json_extract(OLD.payload,'$.drafts'),'{}')) BEGIN SELECT RAISE(ABORT,'Practice is paused'); END;
--> statement-breakpoint
-- Development only. Audit old rows as migration baselines; never infer provider verification.
CREATE TABLE IF NOT EXISTS governance_context (id INTEGER PRIMARY KEY CHECK(id=1),actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),changed_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS governance_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL CHECK(kind IN ('social','group','member')),record_id INTEGER NOT NULL,version INTEGER NOT NULL CHECK(version>=1),
 action TEXT NOT NULL CHECK(action IN ('baseline','create','update','delete')),actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT,changed_at INTEGER NOT NULL,
 UNIQUE(kind,record_id,version)
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_audit_no_update BEFORE UPDATE ON governance_audit BEGIN SELECT RAISE(ABORT,'Governance audit is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_audit_no_delete BEFORE DELETE ON governance_audit BEGIN SELECT RAISE(ABORT,'Retain governance audit'); END;
--> statement-breakpoint
INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) SELECT 'social',r.id,1,'baseline','migration','Existing record before audit migration',NULL,json_object('id',r.id,'platform',r.platform,'label',r.label,'url',r.url,'enabled',r.enabled,'sort_order',r.sort_order,'updated_at',r.updated_at),r.updated_at FROM social_links r WHERE NOT EXISTS(SELECT 1 FROM governance_audit WHERE kind='social' AND record_id=r.id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_social_create AFTER INSERT ON social_links BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('social',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='social' AND record_id=NEW.id),0)+1,'create',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),NULL,json_object('id',NEW.id,'platform',NEW.platform,'label',NEW.label,'url',NEW.url,'enabled',NEW.enabled,'sort_order',NEW.sort_order,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_social_update AFTER UPDATE ON social_links BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('social',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='social' AND record_id=NEW.id),0)+1,'update',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'platform',OLD.platform,'label',OLD.label,'url',OLD.url,'enabled',OLD.enabled,'sort_order',OLD.sort_order,'updated_at',OLD.updated_at),json_object('id',NEW.id,'platform',NEW.platform,'label',NEW.label,'url',NEW.url,'enabled',NEW.enabled,'sort_order',NEW.sort_order,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_social_delete AFTER DELETE ON social_links BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('social',OLD.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='social' AND record_id=OLD.id),0)+1,'delete',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'platform',OLD.platform,'label',OLD.label,'url',OLD.url,'enabled',OLD.enabled,'sort_order',OLD.sort_order,'updated_at',OLD.updated_at),NULL,COALESCE((SELECT changed_at FROM governance_context WHERE id=1),OLD.updated_at));
END;
--> statement-breakpoint
INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) SELECT 'group',r.id,1,'baseline','migration','Existing record before audit migration',NULL,json_object('id',r.id,'platform',r.platform,'title',r.title,'programme',r.programme,'access_tier',r.access_tier,'enabled',r.enabled,'updated_at',r.updated_at),r.updated_at FROM community_groups r WHERE NOT EXISTS(SELECT 1 FROM governance_audit WHERE kind='group' AND record_id=r.id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_group_create AFTER INSERT ON community_groups BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('group',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='group' AND record_id=NEW.id),0)+1,'create',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),NULL,json_object('id',NEW.id,'platform',NEW.platform,'title',NEW.title,'programme',NEW.programme,'access_tier',NEW.access_tier,'enabled',NEW.enabled,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_group_update AFTER UPDATE ON community_groups BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('group',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='group' AND record_id=NEW.id),0)+1,'update',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'platform',OLD.platform,'title',OLD.title,'programme',OLD.programme,'access_tier',OLD.access_tier,'enabled',OLD.enabled,'updated_at',OLD.updated_at),json_object('id',NEW.id,'platform',NEW.platform,'title',NEW.title,'programme',NEW.programme,'access_tier',NEW.access_tier,'enabled',NEW.enabled,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_group_delete AFTER DELETE ON community_groups BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('group',OLD.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='group' AND record_id=OLD.id),0)+1,'delete',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'platform',OLD.platform,'title',OLD.title,'programme',OLD.programme,'access_tier',OLD.access_tier,'enabled',OLD.enabled,'updated_at',OLD.updated_at),NULL,COALESCE((SELECT changed_at FROM governance_context WHERE id=1),OLD.updated_at));
END;
--> statement-breakpoint
INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) SELECT 'member',r.id,1,'baseline','migration','Existing record before audit migration',NULL,json_object('id',r.id,'group_id',r.group_id,'learner_id',r.learner_id,'membership_status',r.membership_status,'payment_status',r.payment_status,'verified_at',r.verified_at,'updated_at',r.updated_at),r.updated_at FROM community_memberships r WHERE NOT EXISTS(SELECT 1 FROM governance_audit WHERE kind='member' AND record_id=r.id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_member_create AFTER INSERT ON community_memberships BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('member',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='member' AND record_id=NEW.id),0)+1,'create',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),NULL,json_object('id',NEW.id,'group_id',NEW.group_id,'learner_id',NEW.learner_id,'membership_status',NEW.membership_status,'payment_status',NEW.payment_status,'verified_at',NEW.verified_at,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_member_update AFTER UPDATE ON community_memberships BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('member',NEW.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='member' AND record_id=NEW.id),0)+1,'update',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'group_id',OLD.group_id,'learner_id',OLD.learner_id,'membership_status',OLD.membership_status,'payment_status',OLD.payment_status,'verified_at',OLD.verified_at,'updated_at',OLD.updated_at),json_object('id',NEW.id,'group_id',NEW.group_id,'learner_id',NEW.learner_id,'membership_status',NEW.membership_status,'payment_status',NEW.payment_status,'verified_at',NEW.verified_at,'updated_at',NEW.updated_at),COALESCE((SELECT changed_at FROM governance_context WHERE id=1),NEW.updated_at));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS governance_member_delete AFTER DELETE ON community_memberships BEGIN
 INSERT INTO governance_audit(kind,record_id,version,action,actor_id,reason,previous_json,next_json,changed_at) VALUES('member',OLD.id,COALESCE((SELECT MAX(version) FROM governance_audit WHERE kind='member' AND record_id=OLD.id),0)+1,'delete',COALESCE((SELECT actor_id FROM governance_context WHERE id=1),'database'),COALESCE((SELECT reason FROM governance_context WHERE id=1),'Unattributed direct database change'),json_object('id',OLD.id,'group_id',OLD.group_id,'learner_id',OLD.learner_id,'membership_status',OLD.membership_status,'payment_status',OLD.payment_status,'verified_at',OLD.verified_at,'updated_at',OLD.updated_at),NULL,COALESCE((SELECT changed_at FROM governance_context WHERE id=1),OLD.updated_at));
END;
