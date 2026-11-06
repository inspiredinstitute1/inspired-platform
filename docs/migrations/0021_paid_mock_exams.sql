-- Private exam papers are never included in the static client catalogue.
CREATE TABLE IF NOT EXISTS exam_papers (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 240),
 access_mode TEXT NOT NULL CHECK(access_mode IN ('free','paid')), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','paused')),
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)), created_at INTEGER NOT NULL, actor_id TEXT NOT NULL, reason TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS exam_codes (
 code_hash TEXT PRIMARY KEY, exam_id TEXT NOT NULL REFERENCES exam_papers(id), email TEXT NOT NULL,
 expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)), used_by TEXT, used_at INTEGER,
 payment_reference TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS exam_grants (
 exam_id TEXT NOT NULL REFERENCES exam_papers(id), learner_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)), code_hash TEXT NOT NULL REFERENCES exam_codes(code_hash),
 PRIMARY KEY(exam_id,learner_id)
);
CREATE TABLE IF NOT EXISTS exam_attempts (
 id TEXT PRIMARY KEY, exam_id TEXT NOT NULL REFERENCES exam_papers(id), learner_id TEXT NOT NULL,
 started_at INTEGER NOT NULL, deadline INTEGER NOT NULL, answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','submitted')), result_json TEXT,
 version INTEGER NOT NULL DEFAULT 1, UNIQUE(exam_id,learner_id)
);
CREATE TABLE IF NOT EXISTS exam_code_limits (learner_id TEXT NOT NULL, window INTEGER NOT NULL, tries INTEGER NOT NULL, PRIMARY KEY(learner_id,window));
CREATE TABLE IF NOT EXISTS exam_audit (id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,record_id TEXT NOT NULL,actor_id TEXT NOT NULL,detail TEXT NOT NULL,changed_at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS exam_code_redeem AFTER UPDATE OF used_by ON exam_codes WHEN OLD.used_by IS NULL AND NEW.used_by IS NOT NULL BEGIN
 INSERT INTO exam_grants(exam_id,learner_id,expires_at,code_hash) VALUES(NEW.exam_id,NEW.used_by,NEW.expires_at,NEW.code_hash)
 ON CONFLICT(exam_id,learner_id) DO UPDATE SET expires_at=excluded.expires_at,revoked=0,code_hash=excluded.code_hash;
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('redeem',NEW.exam_id,NEW.used_by,'Account-bound code redeemed',NEW.used_at);
END;
CREATE TRIGGER IF NOT EXISTS exam_code_revoke AFTER UPDATE OF revoked ON exam_codes WHEN NEW.revoked=1 BEGIN
 UPDATE exam_grants SET revoked=1 WHERE code_hash=NEW.code_hash;
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('revoke',NEW.exam_id,NEW.actor_id,'Code and associated grant revoked',CAST(unixepoch('subsec')*1000 AS INTEGER));
END;
CREATE TRIGGER IF NOT EXISTS exam_paper_audit_insert AFTER INSERT ON exam_papers BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('import',NEW.id,NEW.actor_id,NEW.reason,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS exam_paper_audit_status AFTER UPDATE OF status ON exam_papers BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('status',NEW.id,NEW.actor_id,NEW.reason,CAST(unixepoch('subsec')*1000 AS INTEGER));
END;
CREATE TRIGGER IF NOT EXISTS exam_paper_content_immutable BEFORE UPDATE OF questions_json,duration_minutes,access_mode ON exam_papers BEGIN SELECT RAISE(ABORT,'Import a separate corrected edition'); END;
CREATE TRIGGER IF NOT EXISTS exam_attempt_identity BEFORE UPDATE OF exam_id,learner_id,started_at,deadline ON exam_attempts BEGIN SELECT RAISE(ABORT,'Attempt identity and timer are immutable'); END;
CREATE TRIGGER IF NOT EXISTS exam_attempt_final BEFORE UPDATE ON exam_attempts WHEN OLD.status='submitted' BEGIN SELECT RAISE(ABORT,'Submitted attempt is final'); END;
CREATE TRIGGER IF NOT EXISTS exam_audit_no_update BEFORE UPDATE ON exam_audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
CREATE TRIGGER IF NOT EXISTS exam_audit_no_delete BEFORE DELETE ON exam_audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
CREATE INDEX IF NOT EXISTS idx_exam_attempt_learner ON exam_attempts(learner_id,exam_id);

CREATE TRIGGER IF NOT EXISTS exam_code_issue_audit AFTER INSERT ON exam_codes BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('issue-code',NEW.exam_id,NEW.actor_id,'Manual payment confirmed; email-bound code issued',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS exam_attempt_start_audit AFTER INSERT ON exam_attempts BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('start',NEW.id,NEW.learner_id,'Timed attempt started',NEW.started_at);
END;
CREATE TRIGGER IF NOT EXISTS exam_attempt_submit_audit AFTER UPDATE OF status ON exam_attempts WHEN NEW.status='submitted' BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at) VALUES('submit',NEW.id,NEW.learner_id,'Attempt finalized',CAST(unixepoch('subsec')*1000 AS INTEGER));
END;
