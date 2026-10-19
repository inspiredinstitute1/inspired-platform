# Saved activation/refund relationships

Development-only on draft PR #3. Saved links are reviewed relationships, not verified payments, ledger postings or access grants. Reviewed cross-batch staged targets are now supported; existing-ledger targets remain unsupported. See FINANCE_CROSS_BATCH.md for exact-reference lookup and batch movement scope.

Select an import batch, save both learner/programme reviews, then use Saved activation/refund links. Open/reload a source row, explicitly choose its original payment and give a change reason. Imported learner/course claims and temporary preview dropdowns do not create saved matches. A saved target is selected when reopening its own link; new links start unmatched.

## Rules

| Relationship | Required saved facts |
| --- | --- |
| All active links | Accepted staged source/target rows in the same or different batches, both reviewed, the same saved Student/programme, valid current review versions and source date on/after target date. No existing transaction-table reference for either payment. |
| Activation | APPX activation to non-APPX tuition. Only one current active activation may target that tuition. Amounts remain separate from tuition revenue. |
| Refund | Zero-fee refund to original tuition or mock-test payment. Cumulative current active refunds must not exceed the original gross price. Refund fees, activation refunds and other adjustment directions remain unresolved. |
| Revoked | Retains the existing target and complete history; no deletion. It may be revoked using the current versions even when the reviews are no longer reviewed. |

Active links can be corrected or reactivated with a new reason and current versions. Retargeting retains the previous target/snapshot in audit. Revocation cannot silently replace a target; use Active for a reviewed correction. Review status and evidence decisions are separate records; a saved link does not confirm evidence or approve posting.

Target limits are enforced by database triggers within each write, including competing requests. A conflicting activation or excessive new refund receives 409; its previous link/audit remains unchanged. Earlier explicitly saved valid relationships remain intact. Temporary preview mode instead evaluates all supplied claims together and can block an entire conflicting group. Refund/activation limits conservatively count current saved peer links even if a later account-role change makes a peer unavailable.

## Snapshots and staleness

The server snapshots both saved reviews and immutable imported transactions, including amounts, references, matches, evidence notes and review versions. The caller cannot override snapshots or actor identity. Any saved review change on either side makes an active link stale, even if values are unchanged. Stale/unavailable/revoked links cannot supply a relationship to saved-mode preview.

Effective states: not linked, active, stale, unavailable or revoked. An otherwise current active link is unavailable if its account/programme match no longer qualifies. Revoked links stay revoked when reviews change. Row identity is immutable; target corrections are audited.

Each link has its own optimistic version. Source review, target review and link versions are all checked in the write. A review changed between preflight and persistence, or a competing link edit, receives 409 and preserves unsaved form fields. Open / reload saved link fetches fresh server versions. A lost successful response may also require reload.

The latest 50 audit changes in a selected batch show full before/after snapshots, trusted actor, reason and time. Audit insertion is atomic with the link write; an audit failure rolls back both inserts and updates. Links/history cannot be deleted.

## Preview modes

- Preview saved rows with temporary links uses only the unsaved preview dropdowns; it never writes a link.
- Preview saved rows with saved links ignores temporary dropdown choices and uses current active stored links. The request must pin every activation/refund link version, including version zero for unsaved rows. Missing, duplicate or changed versions receive 409. Both review-version sets are checked again when loading saved relationships.

Saved mode labels link states/versions. Stale/revoked/unavailable/unsaved relationships contribute no activation/refund amount and produce incomplete totals when blocked. External originals are context only; preview amounts describe the selected batch and can be negative for later refunds. The preview always remains unverified and canPost=false, regardless of manual evidence confirmations. Saved-link/evidence changes invalidate earlier output; late preview responses cannot restore it. Unsaved review/link-form edits are excluded from both modes.

## Development checks and limits

Admin-only GET/POST `/api/admin/finance-payment-links`, private/no-store responses, same-origin bounded JSON (8,000 bytes), server account/match validation, no deletion. Migration 0014 follows the base plus thirteen explicit Admin migrations outside the generated Drizzle journal. Remote migration still requires approved isolated staging/backup checks.

Twelve service/database tests, four saved-link frontend tests and two additional preview frontend tests cover permissions, snapshots/actors, source/target/link versions, correction/revoke/reactivate, competing activations, refund limits, audit rollback, existing-ledger references, immutable history, schema reapplication, saved-mode pinning, escaping, unsaved choices and stale responses. Built Worker/local D1 repeats the lifecycle and confirms unchanged Student access. Only synthetic records were used.

Remaining: previous-ledger matching and complete ledger reconciliation, evidence authenticity/provider workflows, explicit approval snapshots, idempotent atomic posting/reversal audit, settlements/fees and paid-access decisions. Actual authenticated browser/mobile/two-device and remote staging checks remain pending. No provider rate or real payment verification is inferred.
