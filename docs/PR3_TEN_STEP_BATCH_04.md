# Ten-step account-safety batch — 20 October 2026

Development only, draft PR #3. Synthetic local state only; no merge, deployment, remote migration, DNS, live-site change, external message or real learner/payment operation.

| Step | Delivered result |
| --- | --- |
| 1 | Reviewed boot, account-cache selection and cloud reconciliation; identified stale tabs potentially submitting their progress after the browser switches sessions. |
| 2 | Added an account-ID precondition to progress reads: a mismatch returns 409 ACCOUNT_CHANGED before any database lookup and exposes no replacement-account payload. |
| 3 | Required the account precondition for progress PUT. Missing binding returns 428; mismatched binding cannot write, regardless of a claimed body ID. Normal session authentication, origin checks and role rules remain authoritative. |
| 4 | Pinned boot and later sync requests to the page's server-provided account ID, safely encoded for transport. The header does not select or authenticate an account. |
| 5 | Validated identity/role, version and main progress container shapes before accepting successful boot/pull/save or version-conflict data into reconciliation. |
| 6 | Paused cloud progress saves after changed/signed-out sessions or changed roles. Pending work stays in its original account device cache, and the UI offers Refresh account without automatic retry. |
| 7 | Kept normal same-account version conflicts working by returning authenticated identity with their reconciliation base; tested that local edits during an in-flight save survive and save in the next version. |
| 8 | Extended the request timeout through response-body JSON consumption; malformed JSON/envelopes, failed requests and timeouts retain pending work and clear the saving flag. |
| 9 | Added sixteen service/UI regressions, including anonymous guest-only boot, cache isolation, refresh presentation and encoded opaque IDs. Built-Worker/local D1 checks simulate stale-tab reads/writes and preserve both account records. |
| 10 | All 304 tests pass, with lint, type checking, bundle syntax, 34-route build, built-Worker role checks and base-plus-twenty-migration local D1 apply/reapply validation. Updated protocol and remaining-work reports accompany the draft PR changes. |

No dependency or migration change is required. Existing clients without the new PUT header must refresh before saving; their failed request retains its local copy. GET without a binding remains session-scoped for compatibility, while this portal always pins it.

Scope/limits: progress sync application safeguards, not a new authentication system, device-cache encryption/erasure or a verified real-browser account-switch flow. No provider authentication, gateway-header security, browser/mobile/two-device interaction, hosted staging/recovery or production release is claimed. See ACCOUNT_PROGRESS_SYNC.md for the protocol and LOCAL_RECOVERY_VALIDATION.md for earlier local recovery evidence.
