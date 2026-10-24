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
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_staged_reference ON finance_import_rows(source,external_reference) WHERE verdict='accepted';
CREATE INDEX IF NOT EXISTS idx_finance_import_batch_rows ON finance_import_rows(batch_id,row_number);
CREATE TABLE IF NOT EXISTS finance_import_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 batch_id TEXT NOT NULL REFERENCES finance_import_batches(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,snapshot_json TEXT NOT NULL,changed_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS finance_import_batch_audit AFTER INSERT ON finance_import_batches BEGIN
 INSERT INTO finance_import_audit(batch_id,actor_id,reason,snapshot_json,changed_at)
 VALUES(NEW.id,NEW.imported_by,NEW.reason,json_object('request_hash',NEW.request_hash,'source_label',NEW.source_label,'total_rows',NEW.total_rows,'accepted_rows',NEW.accepted_rows,'duplicate_rows',NEW.duplicate_rows,'rejected_rows',NEW.rejected_rows),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS finance_import_batch_no_update BEFORE UPDATE ON finance_import_batches BEGIN SELECT RAISE(ABORT,'Import batches are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_batch_no_delete BEFORE DELETE ON finance_import_batches BEGIN SELECT RAISE(ABORT,'Retain import batches'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_row_no_update BEFORE UPDATE ON finance_import_rows BEGIN SELECT RAISE(ABORT,'Import rows are immutable'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_row_no_delete BEFORE DELETE ON finance_import_rows BEGIN SELECT RAISE(ABORT,'Retain import rows'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_audit_no_update BEFORE UPDATE ON finance_import_audit BEGIN SELECT RAISE(ABORT,'Import audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_audit_no_delete BEFORE DELETE ON finance_import_audit BEGIN SELECT RAISE(ABORT,'Import audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS finance_import_row_count_guard BEFORE INSERT ON finance_import_rows
 WHEN NEW.row_number>(SELECT total_rows FROM finance_import_batches WHERE id=NEW.batch_id)
 OR (SELECT COUNT(*) FROM finance_import_rows WHERE batch_id=NEW.batch_id AND verdict=NEW.verdict)>=(SELECT CASE NEW.verdict WHEN 'accepted' THEN accepted_rows WHEN 'duplicate' THEN duplicate_rows ELSE rejected_rows END FROM finance_import_batches WHERE id=NEW.batch_id)
 BEGIN SELECT RAISE(ABORT,'Import row exceeds immutable batch counts'); END;
