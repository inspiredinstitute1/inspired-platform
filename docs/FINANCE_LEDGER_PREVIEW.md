# Saved-payment ledger rules preview

Development-only on draft PR #3. This previews proposed amounts from saved reviews; it never verifies a payment, saves matching links, posts revenue or changes access. No merge, deployment or production migration is authorized.

After selecting an import batch in the Admin workspace, complete matching/evidence review and open Ledger rules preview below the review history. Only saved accepted rows are considered; unsaved review changes are excluded. Select an original payment for each activation/refund and run the preview. Temporary links reset when the batch/reviews reload. A separate [saved-link workflow](FINANCE_PAYMENT_LINKS.md) now persists reviewed same-batch or cross-batch relationships, and the saved-mode preview pins their versions. It ignores unsaved temporary choices.

## Proposed rules

| Record | Preview rule |
| --- | --- |
| Every row | Requires a saved reviewed record, Student account, course/test series and evidence reference. Pending/disputed/missing matches block it. Reviewed is not independent payment verification. |
| Tuition | Separate proposed tuition gross. Never assumes a fee rate or counts an activation as another tuition sale. |
| Mock test | Separate proposed mock-test gross. No group access is granted, including for ₹199 mock-only purchases. |
| Activation | APPX source only; manually link to non-APPX tuition for the same saved learner/programme in this batch. Date must be on/after the tuition date. Amount remains a separate activation receipt. Multiple activations against one tuition block every competing activation pending resolution. |
| Refund | Manually link to original tuition/mock sale for the same saved learner/programme in this batch. Date must be on/after original payment. Only zero-fee refunds are previewed: gross equals net cash returned. Refunds of activations and nonzero refund fees need separate policies. |
| Refund limit | Sum of all selected refunds against an original cannot exceed its gross price. If exceeded, every refund against that original is blocked; no arbitrary partial subset is chosen. Original sale fees are retained. |
| Adjustment / other | Blocked until accounting direction and policy are explicitly defined. |
| Existing ledger reference | Any matching source/reference already in finance_transactions blocks the proposal and any activation/refund depending on it. Existing ledger rows are never altered. |

An activation/refund is also blocked if its target fails the preview rules. Refund checks conservatively include all linked refund claims, including claims with other issues. Saved-mode cross-batch staged targets are supported as context; temporary dropdowns stay within the selected batch. Previous-ledger targets remain unsupported. See FINANCE_CROSS_BATCH.md. These are proposed application rules for review, not verified provider or accounting policies.

## Amounts and interpretation

The preview shows tuition gross after eligible tuition refunds, mock-test gross after eligible mock refunds, separate activation gross, original/activation fees, refund cash outflow and net cash movement. It does not infer platform rates, tax, settlement dates or profitability.

Totals are selected-batch movements, not lifetime revenue. External originals validate relationships but contribute no earlier receipt. A cross-batch refund can therefore produce a negative category/cash movement.

Net cash movement = eligible original tuition/mock/activation net amounts minus eligible zero-fee refund net amounts. Original fees are not refunded automatically; a full price refund can therefore leave negative cash movement for a fee-bearing sale.

Blocked rows and their dependencies contribute nothing. If any row is blocked, displayed totals are explicitly incomplete. Exact integer arithmetic uses BigInt internally; totals outside JavaScript's safe-integer range are unavailable rather than rounded. No preview may be used as confirmed collections, verified revenue, profit, ledger approval or an entitlement decision.

## Consistency, privacy and validation

Admin-only `/api/admin/finance-ledger-preview` uses private/no-store responses, same-origin bounded JSON writes (100,000 bytes), at most 200 accepted rows/versions/links and saved database amounts. Caller-supplied transactions, totals or verification fields have no effect. GET returns read-only usage; DELETE is rejected.

The request must include every accepted row's saved review version. Missing, duplicate or stale versions receive 409; reload the batch before previewing again. Source and review fields are fetched in one joined read. The preview is a point-in-time calculation: later changes can invalidate it, and no approval or posting token is issued. No financial/contact data or links are persisted by previewing.

The preview itself needed no migration. The later [Admin evidence decision workflow](FINANCE_EVIDENCE_DECISIONS.md) adds migration 0013 and displays effective decision states/versions in this preview, without enabling posting. Saved links subsequently add migration 0014. Cross-batch guard migration 0015 follows. Current validation uses the base plus fifteen explicit migrations. Nine policy tests, six service/database tests and three frontend tests cover required reviews, manual linkage, categories, duplicate accounting, refund limits/direction, unavailable matches, exact totals, forged input, stale versions, access/origin, safe rendering and navigation. Service tests confirm no SQLite writes. Built Worker/local D1 checks exercise saved review/activation previews and over-refund blocking with synthetic data only.

## Remaining before ledger posting

Independent evidence authenticity checks, complete previous-ledger reconciliation, fee/refund/settlement policies, posting-time revalidation and idempotent atomic posting/reversal audit are still required. Immutable [approval-review snapshots](FINANCE_APPROVAL_SNAPSHOTS.md) now capture current supporting records without authorizing posting. Durable same-batch/cross-batch reviewed links and manual Admin attestation records now exist but do not establish provider authenticity. Actual provider-authenticated browser/mobile use, isolated remote staging and backup/rollback checks remain pending. This preview always returns canPost=false and verification=unverified.
