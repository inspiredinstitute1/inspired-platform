# Admin payment-evidence decisions

Development-only on draft PR #3. These records capture an Admin's manual check; they do not establish automated provider verification, approve a ledger posting, post revenue or grant access. No real payment evidence was checked in this development milestone.

Select a payment-import batch and save its learner/programme review. Under Admin evidence decisions, open the accepted row. The form displays saved amounts, source/reference/date, learner/programme matches, evidence reference/notes and review version. Unsaved review edits are excluded.

## Recording a decision

| Decision | Use |
| --- | --- |
| pending | A check remains incomplete. A saved pending/disputed review can also receive this decision. |
| confirmed | Admin records that they checked original evidence against the displayed saved payment/matches. Requires a reviewed record, saved Student/programme matches, a checked method, details and a fresh explicit attestation. |
| disputed | Record a concern or reopen an earlier confirmation. This does not confirm evidence. |

Methods are not checked, original provider statement, manually checked provider dashboard or original receipt. Selecting a method never connects to a provider, fetches a statement, authenticates a receipt or proves authenticity. Do not record a confirmation merely because an imported row passed validation. Retain original evidence separately; passwords, banking credentials and full card details do not belong in notes.

Each save requires a reason. The checkbox starts unchecked whenever a decision is opened/reloaded, including an earlier confirmation. Pending/disputed saves do not attest confirmation. The server records the signed-in Admin actor and captures the snapshot from the database; imported/caller actor, amount or snapshot fields cannot override it.

## Versions and retained history

The decision captures the exact saved review version, matched IDs, review status, evidence reference/notes and immutable normalized transaction. Its own version protects competing decision edits. A change to any saved review increments its version and makes the older decision stale, even if field values are identical. Stale confirmations remain in history and cannot serve as current evidence. Open/reload the decision, check the current saved facts and explicitly reconfirm.

A previously confirmed decision also becomes unavailable if the saved learner now resolves to Admin or its match no longer qualifies. Effective states are not recorded, pending, confirmed, disputed, stale and unavailable. Staleness is derived from current review version; history is never silently rewritten or deleted.

Creates/updates bind the expected review version within the SQL write, so a review changed between validation and persistence returns 409. Decision version conflicts also return 409; unsaved notes/choices remain on screen. Reload before retrying. A successful save with a lost response can require the same reload.

Append-only before/after audit shows the latest 50 changes in the batch, server actor, reason and time. Audit inserts commit atomically with the decision; audit failure rolls back the whole decision write. Imported rows, row identity, snapshots and decision/audit deletion are protected by database relationships/triggers.

## Ledger preview

The saved-ledger preview displays each row's effective evidence state and decision version. It identifies whether all rows have current manual confirmations and adds a confirmation blocker when they do not. Rule-eligible proposed amounts still describe accounting rules only; a missing/disputed/stale decision does not turn them into verified amounts or change their arithmetic. The preview always remains unverified and canPost=false, even if all manual confirmations are current. Any evidence-decision save clears earlier displayed preview results so they must be rerun.

## Development checks and limits

Admin-only GET/POST `/api/admin/finance-evidence`, private/no-store responses, same-origin JSON writes and an 8,000-byte request limit. Only accepted import rows with a saved review can receive decisions. The selected batch holds at most 200 accepted rows. Migration 0013 follows the base and twelve explicit Admin migrations, outside the generated Drizzle journal. Apply remote/production migrations only after separately approved staging/backup checks.

Ten service/database tests and four frontend tests cover roles/origin, required attestations, server snapshots/actors, Unicode limits, stale versions, review races during writes, confirmation/dispute/reopen, audit rollback, immutable history, migration reapplication, role changes, preview integration, escaping, unsaved inputs and late responses. Built Worker/local D1 checks repeat the lifecycle with synthetic records. Existing ledger/enrolment tables remain unchanged by this workflow.

Durable reviewed links across batches, provider/evidence authenticity workflows, ledger approval snapshots, idempotent posting/reversal audits, settlements and paid-access decisions remain separate future work. Provider-authenticated browser/mobile/two-device and remote isolated staging verification are still pending.
