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
CREATE INDEX IF NOT EXISTS idx_programme_resource_order ON programme_resources(node_id,sort_order,id);
CREATE TABLE IF NOT EXISTS resource_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 link_id TEXT NOT NULL REFERENCES programme_resources(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS resource_identity_immutable BEFORE UPDATE ON programme_resources
 WHEN OLD.node_id!=NEW.node_id OR OLD.resource_kind!=NEW.resource_kind OR OLD.resource_id!=NEW.resource_id
 BEGIN SELECT RAISE(ABORT,'Resource link identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS resource_no_delete BEFORE DELETE ON programme_resources
 BEGIN SELECT RAISE(ABORT,'Disable resource links instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS resource_audit_insert AFTER INSERT ON programme_resources BEGIN
 INSERT INTO resource_audit(link_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id', NEW.id, 'node_id', NEW.node_id, 'resource_kind', NEW.resource_kind, 'resource_id', NEW.resource_id, 'enabled', NEW.enabled, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS resource_audit_update AFTER UPDATE ON programme_resources BEGIN
 INSERT INTO resource_audit(link_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id', OLD.id, 'node_id', OLD.node_id, 'resource_kind', OLD.resource_kind, 'resource_id', OLD.resource_id, 'enabled', OLD.enabled, 'sort_order', OLD.sort_order, 'version', OLD.version),json_object('id', NEW.id, 'node_id', NEW.node_id, 'resource_kind', NEW.resource_kind, 'resource_id', NEW.resource_id, 'enabled', NEW.enabled, 'sort_order', NEW.sort_order, 'version', NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS resource_audit_no_update BEFORE UPDATE ON resource_audit BEGIN SELECT RAISE(ABORT,'Resource audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS resource_audit_no_delete BEFORE DELETE ON resource_audit BEGIN SELECT RAISE(ABORT,'Resource audit is append-only'); END;
