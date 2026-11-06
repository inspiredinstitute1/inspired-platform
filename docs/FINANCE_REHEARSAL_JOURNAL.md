# Synthetic local ledger rehearsal

This milestone tests journal mechanics with synthetic fixtures. It does **not** implement real payment verification, production ledger posting, financial reconciliation, settlement or access grants. Existing finance previews and approvals continue to return `canPost=false` and `verification=unverified`.

## Local enablement

The Admin-only `/api/admin/finance-rehearsal` endpoint is disabled by default. It requires both `FINANCE_REHEARSAL_MODE=synthetic-local-only` and a plain HTTP loopback request URL (`127.0.0.1`, `localhost` or `[::1]`). No committed hosting configuration enables it. The local role-validation script supplies the flag only to its disposable Worker process. Do not enable it on a hosted environment.

This gate is an operational boundary for local tests, not a provider-authentication or data-authenticity guarantee. Use an isolated placeholder D1 database with synthetic data only. Fixture names are an additional mistake guard, not proof that a payment is synthetic: the selected import label must start `Synthetic ` and every captured supporting transaction reference must start `SYNTHETIC-`. There is no product UI or enable switch.

## Operations

`GET` lists the latest thirty operation summaries. `GET ?operationId=<UUID>` returns one operation and its entries (at most the import's 200 selected rows).

`POST` accepts:

```json
{
  "requestId": "00000000-0000-4000-8000-000000000001",
  "action": "post",
  "approvalId": "00000000-0000-4000-8000-000000000002",
  "syntheticAcknowledgement": true,
  "reason": "Synthetic local journal rehearsal"
}
```

A reversal uses `action: "reverse"` and the original post's `operationId` instead of `approvalId`. A fresh request ID denotes a new command. Retry identical input with the same ID to recover a lost response; changing that input conflicts. Actors, captured payments, amounts, mappings and movements come from the server. Caller-supplied entries, totals or verification claims cannot override them.

Posting requires a complete, current, latest `review_approved` snapshot. Server preflight recalculates eligibility and compares exact scope. The write repeats current scope/latest-decision checks inside SQL; migration 0017 independently guards inserts. A new hold or supporting-record change during the save rejects the whole command.

One database statement creates the operation, entries and audit via triggers. Failures roll back all three. Separate rehearsal tables never write `finance_transactions`, enrolments, community membership or payment/evidence decisions. Amounts are derived from the captured selected rows, with tuition, mock, activation, fees, refunds and cash movements separate. Earlier cross-batch original receipts contribute context only; a refund's movement can be negative.

Each accepted row can receive one original rehearsal entry in its lifetime. A new approval or request ID cannot duplicate it, including after reversal. Corrections/reposting are deliberately unsupported until a separate revision policy exists.

Cross-batch dependencies require an active rehearsal original with an identical captured supporting row. Changes to its identity/review/evidence/link/programme facts block attaching new dependants to the earlier entry. They do not rewrite earlier history. Saved-link revocation does not erase existing active journal commitments: journal-wide refund/activation limits are checked atomically in addition to current preview rules.

Reversal appends exact negative entries linked to the originals and retains both operations/audits. It does not edit or delete history and does not require an old approval to remain current. An original batch cannot be reversed while another active rehearsal batch depends on its receipts; reverse dependants first. Same-batch relationships reverse together. Reversing a reversal, a second reversal or attaching new dependants to reversed originals is rejected. Reversal does not revoke saved links/evidence; those records may conservatively reserve amounts until reviewed separately.

## Requirements before real posting

These are proposed engineering acceptance requirements, not a claim of available provider integrations:

1. Define and implement a trusted verification source for each payment channel. A manual evidence confirmation, receipt reference, uploaded screenshot or review-approved snapshot alone must remain insufficient.
2. Bind independent verification to exact source/reference, amount/fee/net, currency, event type/date, learner/programme mapping and original-payment relationship. Retain provenance, verifier identity/method, immutable evidence identity and verification version. Cash/manual channels need an explicitly agreed independent checking workflow.
3. Reject missing, disputed, stale or superseded evidence. Revalidate those records and the latest approval inside the same real ledger transaction. A caller's `verified` boolean cannot supply evidence.
4. Agree previous-ledger matching, correction/reposting, fee/refund/settlement and provider-event idempotency policies. Keep activation receipts separate from tuition and mock-only purchases separate from premium/community access.
5. Design a real append-only ledger/audit model and reconcile any existing records. The rehearsal schema is not a production ledger migration path and its entries must never be promoted into verified totals.
6. Complete authenticated browser/mobile and isolated staging/backup/rollback verification. Owner approval remains required for merge, deployment, production migrations, DNS or live-site changes.

## Validation

Seventeen service/database tests cover local gating, authorization/origin/bounds, server-derived facts, tuition/mock/activation/refund movements, exact compensating reversal, retry recovery including a concurrent identical command, duplicate prevention, holds/staleness/restoration, atomic scope/decision races, failed-entry/audit rollback, cross-batch dependencies, persistent commitment caps, immutable history and migration reapplication. The full suite has 235 passing tests. Local D1 validates seventeen explicit migrations and retains synthetic posting/reversal/audit rows on reapplication. Built Worker/local D1 checks exercise the endpoint with disposable fixtures. Provider-authenticated sessions and browser/mobile behavior remain unverified.

Independent-verification request intake is now available in development (FINANCE_VERIFICATION_REQUESTS.md). It freezes expected claims and retains dispute/cancellation history; no provider adapter is configured and the rehearsal journal never treats its requests as verified evidence.
