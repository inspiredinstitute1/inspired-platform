-- Apply after 0021 and before the complimentary-code application version.
-- Existing paid codes and historical audit records are retained.
CREATE TABLE IF NOT EXISTS exam_complimentary_codes (
 code_hash TEXT PRIMARY KEY CHECK(length(code_hash)=64),
 exam_id TEXT NOT NULL REFERENCES exam_papers(id),
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 300),
 actor_id TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS exam_complimentary_paper_guard BEFORE INSERT ON exam_complimentary_codes BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM exam_papers WHERE id=NEW.exam_id AND access_mode='paid' AND status='published')
 THEN RAISE(ABORT,'Publish a paid paper first') END;
END;
DROP TRIGGER IF EXISTS exam_code_issue_audit;
CREATE TRIGGER exam_code_issue_audit AFTER INSERT ON exam_codes WHEN NEW.payment_reference<>'' BEGIN
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at)
 VALUES('issue-code',NEW.exam_id,NEW.actor_id,'Manual payment confirmed; email-bound code issued',NEW.created_at);
END;
-- One statement creates metadata, the redeemable code and its truthful audit entry.
CREATE TRIGGER IF NOT EXISTS exam_complimentary_issue AFTER INSERT ON exam_complimentary_codes BEGIN
 INSERT INTO exam_codes(code_hash,exam_id,email,expires_at,payment_reference,actor_id,created_at)
 VALUES(NEW.code_hash,NEW.exam_id,NEW.email,NEW.expires_at,'',NEW.actor_id,NEW.created_at);
 INSERT INTO exam_audit(kind,record_id,actor_id,detail,changed_at)
 VALUES('issue-complimentary-code',NEW.exam_id,NEW.actor_id,'Complimentary access; no payment claimed. Reason: '||NEW.reason,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS exam_complimentary_no_update BEFORE UPDATE ON exam_complimentary_codes BEGIN
 SELECT RAISE(ABORT,'Complimentary issuance is immutable; revoke the access code instead');
END;
CREATE TRIGGER IF NOT EXISTS exam_complimentary_no_delete BEFORE DELETE ON exam_complimentary_codes BEGIN
 SELECT RAISE(ABORT,'Complimentary issuance is retained; revoke the access code instead');
END;
