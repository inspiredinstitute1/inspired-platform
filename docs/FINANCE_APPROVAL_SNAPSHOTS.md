# Immutable approval-review snapshots

Development-only on draft PR #3. A review approval records an Admin decision about captured accepted records. It is not provider verification, a ledger-posting permission, a payment transfer or an access grant. No real payments were approved or posted in this development milestone.

## Capture a review decision

Select an import batch and complete its saved reviews, payment relationships and manual evidence decisions. Approval-review snapshots appears below Ledger rules preview. Reload current candidate to fetch a fresh server capture. Temporary preview choices and unsaved form edits are excluded.

The candidate shows accepted-row counts, excluded duplicate/rejected counts, proposed selected-batch movements and the exact supporting records. Duplicates/rejected records remain in import history and are not approved by this accepted-row review. Earlier context receipts are excluded; later refunds can produce negative batch movements. These are not lifetime revenue or profit.

Choose Hold to retain unresolved review, or Approve captured review when available. Approval requires all selected accepted payment rules to pass, exact current saved relationships, safe complete totals and current manual evidence confirmations for selected payments and external originals. Give a reason and explicitly attest that you reviewed the captured facts. The checkbox starts unchecked after reload. A hold does not attest approval.

Saving never changes finance_transactions, evidence decisions, enrolments or group access. All responses remain verification=unverified and canPost=false. Existing independent-evidence/posting blockers remain in the captured preview even when its review is approved.

## What is frozen

One canonical database read defines the scope:

- The selected immutable import batch and its accepted row IDs.
- Saved reviews and normalized transactions for selected payments and their saved original targets, including targets in other batches.
- Account identity fields, directly matched programme identity/status/version, manual evidence records and their exact snapshots, and saved link records/versions.
- All saved peer relationships targeting those originals, including current, stale and revoked peers, plus their supporting records. Peer records are context/commitments; they are not approved as selected payments.
- Existing transaction-table matches by source/reference, and relevant identity/ledger change counters.

The scope includes a policy marker and the Admin identity configuration. A SHA-256 fingerprint identifies these exact facts; it is not a receipt-authenticity signature. Submitted totals, snapshots, verified flags and actor IDs cannot override server facts. The server also calculates the captured preview from this scope.

The save statement compares the scope again within its database write. A database trigger repeats that condition. A source/target/evidence/link or peer-membership change between candidate loading, validation and persistence returns 409 without a partial snapshot or audit. Reapproval requires a new candidate and reason.

## Current, stale, held and superseded

Snapshots and their creation audits are immutable and cannot be deleted. Reloading history derives current/stale status from supporting records; it never rewrites captured evidence.

A relevant review, evidence, link, peer commitment, account identity, programme or matching ledger change makes the snapshot stale. Monotonic identity/ledger counters prevent change-then-restore operations from reviving old approvals. Ordinary learning-progress payload updates do not advance identity counters when name/email are unchanged. Unrelated imports outside the scope do not invalidate it.

For the same exact current scope, the latest captured decision supersedes earlier decisions. A later hold therefore supersedes an earlier review approval, preserving both records. Audit sequence, rather than timestamp alone, determines this order. Effective states include review approved, held, stale, superseded and unavailable. Unavailable means current scope could not be validated; retained snapshot details remain readable and cannot enable posting.

Only a new explicitly saved decision changes the review history. Identical request retries recover the same immutable record after a lost response. Reusing a request ID with changed input receives 409. Failed/conflicting saves retain unsaved inputs. Local supporting-record saves invalidate the displayed candidate; reload before saving another decision.

## Audit and limits

The current batch shows its latest 20 snapshot summaries and 50 creation audit events. View captured record opens the exact stored scope and preview with current/stale status. Capture and audit commit atomically; audit failure rolls back the snapshot. No approval token is issued for a later posting action.

Admin-only GET/POST `/api/admin/finance-approvals`, same-origin JSON writes, private/no-store responses, 3,000-byte write limit. Writes contain an expected scope hash and decision; large supporting records are read from D1. Capture is bounded to 600 scoped records, 400 relevant peer links and 250,000 UTF-8 bytes. SQL uses overflow sentinels and never silently approves a truncated scope. Larger histories need a later review design; unavailable candidates cannot be approved.

Migration 0016 follows the base and fifteen explicit Admin migrations outside the generated Drizzle journal. It adds immutable snapshot/audit tables, scope guards and monotonic identity/ledger counters. Policy changes must update the policy marker and matching database guard in a new migration so earlier decisions cannot silently inherit changed rules. Remote/production migration requires separately approved staging/backup checks.

Fifteen service/database tests and four frontend tests cover stable scope, eligibility/holds, trusted facts, retries, source/target/evidence/link/peer invalidation, identity/programme/ledger changes, restoration protection, unrelated imports, save-time races, atomic audit rollback, immutable history, superseding holds, bounded failures, escaping, retained inputs and late responses. Built Worker/local D1 checks use synthetic records to exercise hold/approval, exact scope, idempotent retry, peer-driven staleness, audit retention and disabled posting/access.

Remaining: independently authenticated evidence/provider workflows, idempotent atomic ledger posting/reversal audit, previous-ledger reconciliation, settlements/fees and paid-access decisions. Any future posting workflow must revalidate the full scope, the latest review decision and real evidence requirements. Provider-authenticated browser/mobile/two-device and isolated remote staging verification remain pending.
