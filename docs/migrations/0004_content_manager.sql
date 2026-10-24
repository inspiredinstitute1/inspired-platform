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
CREATE INDEX IF NOT EXISTS idx_content_parent_order ON content_nodes(parent_id,sort_order,id);
CREATE TABLE IF NOT EXISTS content_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 node_id TEXT NOT NULL REFERENCES content_nodes(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_audit_node ON content_audit(node_id,id);
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
CREATE TRIGGER IF NOT EXISTS content_kind_immutable BEFORE UPDATE ON content_nodes
 WHEN OLD.kind!=NEW.kind BEGIN SELECT RAISE(ABORT,'Programme kind cannot change'); END;
CREATE TRIGGER IF NOT EXISTS content_no_delete BEFORE DELETE ON content_nodes
 BEGIN SELECT RAISE(ABORT,'Archive programme records instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS content_audit_insert AFTER INSERT ON content_nodes BEGIN
 INSERT INTO content_audit(node_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'kind', NEW.kind, 'parent_id', NEW.parent_id, 'title', NEW.title, 'description', NEW.description, 'status', NEW.status, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS content_audit_update AFTER UPDATE ON content_nodes BEGIN
 INSERT INTO content_audit(node_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'kind', OLD.kind, 'parent_id', OLD.parent_id, 'title', OLD.title, 'description', OLD.description, 'status', OLD.status, 'sort_order', OLD.sort_order, 'version', OLD.version),json_object('id', NEW.id, 'kind', NEW.kind, 'parent_id', NEW.parent_id, 'title', NEW.title, 'description', NEW.description, 'status', NEW.status, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS content_audit_no_update BEFORE UPDATE ON content_audit BEGIN SELECT RAISE(ABORT,'Programme audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS content_audit_no_delete BEFORE DELETE ON content_audit BEGIN SELECT RAISE(ABORT,'Programme audit is append-only'); END;
