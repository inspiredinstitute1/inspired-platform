# Unverified payment import review — development only

Step 1 adds an Admin review area for normalized payment records. It does not connect to APPX/PhonePe, import real account data automatically, verify a payment or post revenue. All validation uses synthetic local data on draft PR #3. No live-site, production-database or DNS change was made.

## Prepare and import

Open Admin → Payment import review. Add a source/export label and a reason, choose normalized JSON or CSV, then paste 1–200 rows. The request limit is 100 KB including the JSON envelope. Source labels identify where records came from; the original provider export is not uploaded or independently verified here.

Map provider columns manually to the header-only CSV template before importing. CSV headers may be reordered but must be unique and canonical. Required columns are source, externalReference, transactionKind, grossPaise, netPaise and paidAt. Optional columns are studentId, courseCode and feePaise. feePaise defaults to zero; empty CSV studentId becomes null.

Supported sources: appx, phonepe, upi, cash, bank, other. Supported kinds: tuition, mock_test, activation, refund, adjustment, other. Amounts are nonnegative integer paise (₹999 is 99900 paise), without currency symbols/decimal rupees; gross minus fee must equal net. Dates use valid YYYY-MM-DD calendar dates. Refund direction/accounting and settlement reconciliation are future review work; a staged refund is not automatically subtracted from revenue.

For JSON, paste an array with those canonical fields and numeric paise values. For CSV, quoted commas/quotes, BOM and CRLF are supported. Unknown CSV headers and malformed quoting reject the request. Invalid rows/column counts are retained as rejected review rows when the surrounding file format is valid. The original provider's date/amount format is not guessed.

## Review results

- Accepted for review means format/amount checks passed. The record is still unverified.
- Duplicate means the source/reference already appears in this batch, accepted staging rows or the existing transaction table. It is excluded from accepted review rows. Conflicting normalized details are flagged; existing rows are not overwritten.
- Rejected rows retain a bounded canonical snapshot and issue. Invalid/unknown JSON fields outside the canonical set are not saved. Snapshot strings are limited to 1,000 characters; keep the original source export separately for evidence.

A supplied studentId is a claimed match, not an authenticated learner mapping. Missing learners and activation-to-tuition matching are flagged. Importing never creates a learner, grants APPX/course/group access or changes verified-revenue totals. Recent batches (20), the selected batch's rows (up to 200) and recent audit entries (50) are available for Admin review. Large-history pagination and search are pending.

## Reliability and history

The browser retains the same request ID while retrying identical input after a failed/lost response. Changed input gets a new ID. The server fingerprints the source label, reason, format and data; identical retries return the saved batch, while changed input under an existing ID receives 409. The fingerprint establishes retry identity, not authenticity of a provider statement.

References are unique by source plus external reference among accepted staging rows. Bulk duplicate lookup uses two bounded JSON-parameter queries; batch and rows are saved in two SQL statements within one atomic D1 batch. Concurrent reference collisions reject and roll back the losing batch; a subsequent retry can stage the record as a duplicate. Batch audit commits atomically with source rows. Any failed row/audit write rolls back the whole import. Counts and row positions guard against adding rows beyond an immutable batch.

Batch records, canonical rows and append-only audit cannot be updated/deleted through this workflow. Corrections require retained new source records and a later review process. Clearing the form clears input only. No staging record is promoted to verified here, and finance_transactions is unchanged. Admin actor identity comes from the trusted session, never imported fields.

## Migration and checks

Explicit migration 0011_finance_import_staging.sql follows the base and ten Admin migrations, outside the generated Drizzle journal. Local checks apply/reapply all eleven migrations and preserve synthetic rows with valid foreign keys. Ten service/parser/database tests and three frontend tests cover roles/origin, CSV/JSON/field validation, duplicate conflicts, idempotency, concurrent writes, rollback, immutable audits, bounded snapshots, pending saves and safe rendering. Built Worker/local D1 checks verify 200-row import/readback and replay.

Actual provider export mapping, payment evidence verification, saved learner/course matching, reviewed ledger approval, settlements/refunds/revenue exports, browser/mobile interaction and remote staging remain pending. No real learner/payment records were imported during this work.
