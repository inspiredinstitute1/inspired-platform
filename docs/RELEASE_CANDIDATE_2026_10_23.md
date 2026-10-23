# InspirED Version 3 — private release candidate, 23 October 2026

This candidate continues draft GitHub PR #3, whose starting head is `89bb6d3bfe802f8249a43d4e2764efd0fa38da64`. It also retains the private staging migration journal and gateway fixes from Sites version 9 (`9ff05090710cbb29398672af7a4dd3bb4aa4f011`). No merge, public deployment, domain or DNS change is authorized.

## Release scope

Admin and Student remain the only base roles. Free notes/PDFs, practice, video classes, private progress, timed tests, reviewed CSV/JSON imports and exam analytics work through the existing application. Premium courses remain in APPX. Optional finance/faculty/community tools remain isolated behind their existing permissions. No new payment processor or identity provider is introduced.

## Changes

- Fixed a confirmed import blocker: the shared API transport previously capped `/api/admin/exams` at 3,000 bytes, rejecting normal papers before their validation handler. It now permits 1,500,000 bytes with bounded buffering. File/pasted input is limited to 1 MB and paper size to 250 questions.
- Added paste-based CSV/JSON preview for mobile Admin use. File and pasted input cannot be submitted together. Preview remains read-only; saving creates a private immutable draft; publication requires a separate status action. Original options/keys are retained.
- Exam writes now require a tab/account binding. Missing bindings return 428 and stale account bindings return 409 before changing paper, redemption or attempt records. Server identity and Admin permissions remain authoritative.
- Added one-question-at-a-time exam navigation, answered/unanswered indicators, Previous/Next controls, focus movement and unanswered count at final submission. Unsaved answers, save versions and the original server deadline survive question navigation.
- Admin difficulty flags now include the exact question/options/key/explanation and sort by wrong/skipped response rate. Student reports omit cohort/other-learner/flagged-question data. Admin can inspect their own report separately; owner practice remains excluded from the cohort.
- Applied no-store to app HTML/API responses and added nosniff, strict-origin referrer handling and camera/microphone/location restrictions. Private staging metadata is noindex. Existing PWA private-cache exclusions remain.
- Added explicit in-page start/final-submit confirmations with keyboard focus and visible error feedback. The timer starts only after confirmation.
- Fixed a clipped Admin link on short desktop windows by allowing the sidebar to scroll.
- Retained black/gold glassmorphic design, mobile navigation and free-versus-premium routes. Moved the Admin introduction above the management tools.

## Validation

Automated and hosted observations are recorded separately. No real payment, learner roster or private question bank is used for validation.

- 367 automated tests pass with zero failures/skips. TypeScript and the production Worker build pass. Built runtime checks also pass a full 250-question import preview through the HTTP transport.
- Built-Worker role/runtime checks cover unauthenticated and Student denial, account isolation, CSRF, version conflicts, paid/complimentary codes, deadline persistence, scoring, imports, analytics, material privacy and module guards. Identities in this suite are synthetic trusted headers; this does not prove provider/gateway isolation.
- Local SQL recovery: 49 application tables, exact rows/schema/audits/sequences, foreign keys, deleted-ID safety, immutable guards and restore into fresh targets passed.
- Local D1/R2 recovery: four synthetic PDFs, exact bytes/SHA-256, HTTP/custom metadata, PDF rows/audits and missing/corrupt-object rejection passed.
- Bounded local concurrency passed 25 synthetic accounts, 25 competing exam saves/submissions with exact cohort totals, and four simultaneous 5 MiB PDF reads. The run made 286 requests; local capacity is not hosted capacity.
- Current restricted Sites access allows the existing owner and previously invited viewer only. It is not public. The existing external viewer's permissions are preserved.

## Public-release gates

1. Complete a real separately authenticated Student session and cross-account/device switching. A successful Admin browser session plus local role simulations is insufficient evidence.
2. Establish supported hosted D1 and R2 backup/export/restore into a separate empty target and operational ownership. The available Sites connector exposes database inspection but no hosted backup/restore operation; do not add a privileged database-recovery endpoint to bypass that boundary. Local rehearsal does not close this gate.
3. Validate physical phone PWA install/relaunch, offline behavior, screen-reader behavior and hosted capacity/quotas. Responsive desktop-browser checks do not establish these.
4. Review the production database's migration history and recovery checkpoint before any future target migration. Retain existing applied staging journal files unchanged; no schema migration is added by this candidate.
5. Obtain explicit owner approval for the exact public target/version, merge and any DNS/domain changes. Paid code issuance remains manual owner confirmation, not independent PhonePe/APPX/Razorpay verification. Provider reconciliation remains disabled.

Decision: eligible for private acceptance testing once checks and private deployment succeed. Public release approval is withheld until the remaining gates are resolved or their concrete limits explicitly accepted by the owner.

## Hosted acceptance evidence — Sites version 11

Validated private Worker source: `dbc1d08d84cdbf293c14ae25c6cb38c4e3bbfed4`. The existing custom private allowlist is unchanged. The build is deployed at the existing restricted staging URL; production domains and GitHub main are untouched.

- Real authenticated Admin browser: pasted a labelled ten-question AI-generated model paper, reviewed it, saved a draft, reviewed the retained questions and published it within the private environment. No real examination paper was imported.
- Started the free timed attempt with explicit confirmation. Selected five correct answers, refreshed, confirmed all five persisted and the countdown continued. Added four wrong answers and left one unanswered. Final confirmation returned exactly 4/10, five correct, four wrong and one skipped.
- Own analytics returned 55.6% accuracy, 90% attempted, one deducted mark, a five-response strength and a five-response weakness. The cohort retained its pre-existing synthetic result and excluded this new Admin practice attempt.
- A locked paid paper was unlocked with an email-bound complimentary code for the existing tester account. The audit explicitly claims no payment. Replay returned the expected invalid/already-redeemed response. Two synthetic complimentary test codes were issued; one was redeemed and the first remains unredeemed, with one-day expiry. No real learner code was issued and no payment was confirmed.
- Admin readiness reports 22 expected migration files, 232 schema objects and readable PDF-storage metadata.
- Responsive desktop-browser checks measured actual document widths of 310px and 382px. Exam navigation, result/analytics and account views had no document horizontal overflow in the inspected states. Both themes were exercised. These are not physical-phone or screen-reader certification.
- The published homophones note reader and APPX routing were inspected in the browser. Premium courses still link to the existing Android app; the website does not activate APPX courses.
- A request with caller-supplied synthetic identity headers and no valid session received HTTP 401 at the hosted boundary. Service-access checks received 403 and did not reach usable Admin data. These bounded negative checks do not establish two-account provider isolation or complete gateway penetration testing.

The internal preview browser was unavailable under its browser URL policy; no workaround was attempted. Hosted browser validation used the connected browser against the authorized restricted Site.

**Readiness:** validated private acceptance candidate. Public release remains blocked by a fresh separate Student/account-switch check, supported hosted backup/restore proof, physical-device/PWA checks, hosted capacity and a target-specific production migration/release decision. This report is evidence, not authorization to merge or publish publicly.
