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
CREATE INDEX IF NOT EXISTS idx_pdf_materials_status ON pdf_materials(status,updated_at,id);
CREATE TABLE IF NOT EXISTS pdf_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 file_id TEXT NOT NULL REFERENCES pdf_materials(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS pdf_identity_immutable BEFORE UPDATE ON pdf_materials
 WHEN OLD.id!=NEW.id OR OLD.object_key!=NEW.object_key OR OLD.file_name!=NEW.file_name OR OLD.bytes!=NEW.bytes OR OLD.sha256!=NEW.sha256
 BEGIN SELECT RAISE(ABORT,'PDF file identity is immutable; upload a new draft'); END;
CREATE TRIGGER IF NOT EXISTS pdf_no_delete BEFORE DELETE ON pdf_materials
 BEGIN SELECT RAISE(ABORT,'Archive PDFs instead of deleting'); END;
CREATE TRIGGER IF NOT EXISTS pdf_audit_insert AFTER INSERT ON pdf_materials BEGIN
 INSERT INTO pdf_audit(file_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,NULL,json_object('id',NEW.id,'object_key',NEW.object_key,'file_name',NEW.file_name,'bytes',NEW.bytes,'sha256',NEW.sha256,'title',NEW.title,'category',NEW.category,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS pdf_audit_update AFTER UPDATE ON pdf_materials BEGIN
 INSERT INTO pdf_audit(file_id,actor_id,reason,previous_json,next_json,changed_at)
 VALUES(NEW.id,NEW.changed_by,NEW.change_reason,json_object('id',OLD.id,'object_key',OLD.object_key,'file_name',OLD.file_name,'bytes',OLD.bytes,'sha256',OLD.sha256,'title',OLD.title,'category',OLD.category,'status',OLD.status,'version',OLD.version),json_object('id',NEW.id,'object_key',NEW.object_key,'file_name',NEW.file_name,'bytes',NEW.bytes,'sha256',NEW.sha256,'title',NEW.title,'category',NEW.category,'status',NEW.status,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS pdf_audit_no_update BEFORE UPDATE ON pdf_audit BEGIN SELECT RAISE(ABORT,'PDF audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS pdf_audit_no_delete BEFORE DELETE ON pdf_audit BEGIN SELECT RAISE(ABORT,'PDF audit is append-only'); END;
