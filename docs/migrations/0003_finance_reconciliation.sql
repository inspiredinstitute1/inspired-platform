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
CREATE INDEX IF NOT EXISTS idx_finance_student ON finance_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(paid_at);
