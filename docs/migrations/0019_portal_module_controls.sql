-- Development only. Section switches do not make free/public material private.
CREATE TABLE IF NOT EXISTS portal_modules (
 module_key TEXT PRIMARY KEY CHECK(module_key IN ('library','practice','videos','programmes','teaching','premium')),
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 show_navigation INTEGER NOT NULL DEFAULT 1 CHECK(show_navigation IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
 changed_by TEXT NOT NULL,change_reason TEXT NOT NULL CHECK(length(trim(change_reason)) BETWEEN 3 AND 300),updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_module_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,module_key TEXT NOT NULL REFERENCES portal_modules(module_key) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,previous_json TEXT,next_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS portal_module_insert_audit AFTER INSERT ON portal_modules BEGIN
 INSERT INTO portal_module_audit(module_key,actor_id,reason,previous_json,next_json,changed_at) VALUES(NEW.module_key,NEW.changed_by,NEW.change_reason,NULL,json_object('enabled',NEW.enabled,'showNavigation',NEW.show_navigation,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS portal_module_update_guard BEFORE UPDATE ON portal_modules WHEN NEW.module_key!=OLD.module_key OR NEW.version!=OLD.version+1 BEGIN SELECT RAISE(ABORT,'Module identity is fixed and versions must advance'); END;
CREATE TRIGGER IF NOT EXISTS portal_module_update_audit AFTER UPDATE ON portal_modules BEGIN
 INSERT INTO portal_module_audit(module_key,actor_id,reason,previous_json,next_json,changed_at) VALUES(NEW.module_key,NEW.changed_by,NEW.change_reason,json_object('enabled',OLD.enabled,'showNavigation',OLD.show_navigation,'version',OLD.version),json_object('enabled',NEW.enabled,'showNavigation',NEW.show_navigation,'version',NEW.version),NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS portal_module_no_delete BEFORE DELETE ON portal_modules BEGIN SELECT RAISE(ABORT,'Retain module settings'); END;
CREATE TRIGGER IF NOT EXISTS portal_module_audit_no_update BEFORE UPDATE ON portal_module_audit BEGIN SELECT RAISE(ABORT,'Module audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS portal_module_audit_no_delete BEFORE DELETE ON portal_module_audit BEGIN SELECT RAISE(ABORT,'Retain module audit'); END;
INSERT OR IGNORE INTO portal_modules(module_key,changed_by,change_reason,updated_at) VALUES('library','migration','Preserve existing section availability',0),('practice','migration','Preserve existing section availability',0),('videos','migration','Preserve existing section availability',0),('programmes','migration','Preserve existing section availability',0),('teaching','migration','Preserve existing section availability',0),('premium','migration','Preserve existing section availability',0);
CREATE TRIGGER IF NOT EXISTS portal_practice_insert_guard BEFORE INSERT ON learner_progress WHEN EXISTS(SELECT 1 FROM portal_modules WHERE module_key='practice' AND enabled=0) AND (COALESCE(json_array_length(NEW.payload,'$.attempts'),0)>0 OR COALESCE(json_extract(NEW.payload,'$.drafts'),'{}')!='{}') BEGIN SELECT RAISE(ABORT,'Practice is paused'); END;
CREATE TRIGGER IF NOT EXISTS portal_practice_update_guard BEFORE UPDATE OF payload ON learner_progress WHEN EXISTS(SELECT 1 FROM portal_modules WHERE module_key='practice' AND enabled=0) AND (COALESCE(json_extract(NEW.payload,'$.attempts'),'[]') IS NOT COALESCE(json_extract(OLD.payload,'$.attempts'),'[]') OR COALESCE(json_extract(NEW.payload,'$.drafts'),'{}') IS NOT COALESCE(json_extract(OLD.payload,'$.drafts'),'{}')) BEGIN SELECT RAISE(ABORT,'Practice is paused'); END;
