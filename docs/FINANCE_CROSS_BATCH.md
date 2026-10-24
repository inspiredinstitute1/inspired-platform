# Cross-batch payment matching and preview scope

Development-only on draft PR #3. A saved APPX activation or refund can now reference an original staged tuition/mock payment in another import batch. This does not verify payment, approve/post revenue or grant access. Existing finance_transactions targets still require a separate reconciliation workflow.

## Find and save a match

Save reviewed Student/programme matches for both records. In the source batch, open Saved activation/refund links. Enter the original payment's source and exact external reference under Find an original payment in another batch, then choose Find and select reviewed original.

Lookup searches accepted staged records with reviewed matches, not arbitrary provider accounts or the live ledger. Source/reference uniqueness gives an exact target; wildcard/fuzzy references are not inferred. The source and target must have the same saved Student/programme, eligible kinds/sources and valid dates. Imported studentId/courseCode claims do not select a match.

The result displays the original batch, reference/date, amounts, matches and review version. Check these facts and give a change reason before saving. Lookup itself writes nothing. If the source review changed, reload the saved-link form; lookup cannot silently advance its hidden version. Provider statements/receipts are not fetched or authenticated by this search.

Reopening a saved external target retains its current details for correction or revocation. Source, target and link versions remain protected, with both immutable transactions and saved review snapshots retained in audit. Any review change makes affected active links stale, including when the changed review belongs to another batch. Revoke/reconfirm and lost-response/conflict behaviour follows FINANCE_PAYMENT_LINKS.md.

## Global limits

One current active APPX activation may target a direct tuition payment across all batches. Current active zero-fee refunds targeting one original payment cannot cumulatively exceed its gross price. Database write triggers enforce these limits under competing requests. A conflicting new/retargeted link fails without altering earlier valid links or audits.

Stale/revoked links are not current commitments. Current saved peer links are counted conservatively even if a later account-role change makes one unavailable. An attempt to reactivate a stale link must pass the latest global limits again. Duplicate references already in the transaction table remain blocked.

Both preview modes account for current saved peer commitments outside the selected batch. Temporary dropdowns remain within the selected batch; saved-mode links can use external originals. Refund/activation claims supplied in the preview replace that selected batch's saved relationships for the calculation, so selected sources are not counted twice in peer reservations. The preview displays other-batch commitment counts/amounts separately; these are not verified payments or extra receipts.

## Selected-batch movements

The preview's totalsScope is selected_batch_movement. Only eligible rows imported in the selected batch contribute amounts. An external original payment is context for identity, evidence, chronology and limits; its earlier receipt is never added again.

A later refund against an earlier tuition payment can produce negative tuition gross movement and negative cash movement for the selected refund batch. This is a batch adjustment, not negative lifetime revenue. Selecting an older sale batch does not silently subtract refunds imported in other batches: this preview is not an all-time ledger or revenue dashboard.

Synthetic illustration only: an earlier ₹100 tuition receipt and a later ₹40 refund in a different batch produce -₹40 tuition/cash movement in the refund batch; the original ₹100 is context only. No platform rates or real payment facts are assumed.

API output identifies contextTargets with receiptsCounted=false, target review/evidence versions and otherBatchReservations. Current manual evidence checks include external originals as well as selected rows. Blocked originals block dependants; stale/unavailable/revoked saved links provide no relationship. Selected review versions and link versions must match; a target changing while context loads receives 409. Saved decisions still cannot enable canPost or automated verification.

## Development validation and remaining scope

Migration 0015 replaces only the two payment-link relationship guards to remove the same-batch restriction; snapshots, audits, identity/version guards and global limit triggers remain in force. Existing rows/history are retained. Apply after the base and fourteen explicit Admin migrations, outside the Drizzle journal. All remote/production migrations remain subject to separately approved staging/backup checks.

Nine service/database tests, three lookup/reopen frontend tests and two additional policy tests cover exact authorized lookup, immutable target snapshots, separate receipt accounting, negative refund movement, global activation/refund limits, temporary-mode peer reservations, external review races, context evidence/ledger duplicates and migration reapplication. Existing tests retain rollback, concurrent-write, audit and permission coverage. Built Worker/local D1 validates cross-batch matching, global conflicts, movement totals and stale external targets using only synthetic records.

The preview is a point-in-time read and issues no approval token. Peer commitments can change after a read. The later [approval-review snapshot workflow](FINANCE_APPROVAL_SNAPSHOTS.md) now freezes relevant context/commitment state and detects changes without enabling posting; independent evidence authenticity, ledger reconciliation, idempotent posting/reversal audit, settlement/fee policies and paid-access decisions remain unfinished. Actual provider-authenticated browser/mobile/two-device and remote staging checks are still pending.
