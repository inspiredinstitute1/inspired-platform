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
CREATE INDEX IF NOT EXISTS idx_authored_status ON authored_materials(status,updated_at,id);
CREATE TABLE IF NOT EXISTS material_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 material_id TEXT NOT NULL REFERENCES authored_materials(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 previous_json TEXT,
 next_json TEXT NOT NULL,
 changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS material_identity_immutable BEFORE UPDATE ON authored_materials WHEN OLD.id!=NEW.id
 BEGIN SELECT RAISE(ABORT,'Material identity cannot change'); END;
CREATE TRIGGER IF NOT EXISTS material_no_delete BEFORE DELETE ON authored_materials
 BEGIN SELECT RAISE(ABORT,'Archive materials instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS material_audit_insert AFTER INSERT ON authored_materials BEGIN
 INSERT INTO material_audit(material_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id',NEW.id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS material_audit_update AFTER UPDATE ON authored_materials BEGIN
 INSERT INTO material_audit(material_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id',OLD.id,'title',OLD.title,'category',OLD.category,'body',OLD.body,'status',OLD.status,'version',OLD.version),json_object('id',NEW.id,'title',NEW.title,'category',NEW.category,'body',NEW.body,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS material_audit_no_update BEFORE UPDATE ON material_audit BEGIN SELECT RAISE(ABORT,'Material audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS material_audit_no_delete BEFORE DELETE ON material_audit BEGIN SELECT RAISE(ABORT,'Material audit is append-only'); END;
