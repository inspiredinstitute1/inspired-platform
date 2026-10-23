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

1. Core real-account acceptance passed on 23 October 2026: separately authenticated Admin and Student identities, Student permission denial, cross-account attempt/analytics isolation, timed refresh/submission and private progress saving. See the Student acceptance evidence below. Concurrent stale Admin tabs, expired-provider sessions and two physical devices remain unverified.
2. Establish supported hosted D1 and R2 backup/export/restore into a separate empty target and operational ownership. The available Sites connector exposes database inspection but no hosted backup/restore operation; do not add a privileged database-recovery endpoint to bypass that boundary. Local rehearsal does not close this gate.
3. Validate physical phone PWA install/relaunch, offline behavior, screen-reader behavior and hosted capacity/quotas. Responsive desktop-browser checks do not establish these.
4. Review the production database's migration history and recovery checkpoint before any future target migration. Retain existing applied staging journal files unchanged; no schema migration is added by this candidate.
5. Obtain explicit owner approval for the exact public target/version, merge and any DNS/domain changes. Paid code issuance remains manual owner confirmation, not independent PhonePe/APPX/Razorpay verification. Provider reconciliation remains disabled.

Decision: deployed private candidate with core separately authenticated Admin/Student acceptance passed. Public release approval is withheld until the remaining gates are resolved or their concrete limits explicitly accepted by the owner.

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

**Readiness:** validated private acceptance candidate. The subsequent Student acceptance below closes the core separate-Student check. Public release remains blocked by supported hosted backup/restore proof, physical-device/PWA and concurrent-session checks, hosted capacity and a target-specific production migration/release decision. This report is evidence, not authorization to merge or publish publicly.


## Real Student acceptance — 23 October 2026, 16:53 UTC (22:23 IST)

Target: the existing private Sites version 11 (`dbc1d08d84cdbf293c14ae25c6cb38c4e3bbfed4`). Application source, deployment, access policy, public website, DNS and GitHub main were unchanged by this check. The user completed the separate Student sign-in; no identity headers or Admin role settings were substituted.

| Check | Observed result |
| --- | --- |
| Authenticated identity | Account page identifies the previously permitted Student account and Student role; Admin navigation is absent. The earlier session was authenticated as the separate Admin account. |
| Admin page | Direct `/#/admin` navigation displays “Admin access required” and no management forms. |
| Admin exam API | A browser GET using the real Student session receives HTTP 403 and “Admin access required.” |
| Other account's attempt | Direct GET of the previously recorded Admin attempt receives HTTP 404 and “Attempt not found.” |
| Other account's analytics | A report request targeting the Admin identity receives HTTP 403 and “You can view only your own analytics.” |
| Free/paid separation | The published free model paper is available to start; the paid paper remains locked for this Student. No payment confirmation or new access code was issued. |
| Fresh attempt | The Student receives a separate attempt with 0/10 selected answers and a fresh ten-minute deadline, rather than the Admin's completed attempt. |
| Refresh/resume | Five selections persist after refresh; the timer continues from the original deadline (9:39 before refresh, 9:16 after). |
| Submission/scoring | Five correct, four wrong, one skipped returns exactly 4/10 after explicit final confirmation. |
| Private analytics | Only the Student's two finalized attempts appear: the pre-existing 7.5/10 sample and the new 4/10 model, totaling 11.5/20. Accuracy is 68.4%, coverage 95%, deducted marks 1.5. Cohort and other-learner review controls are absent. |
| Durable note progress | Saved a previously unsaved homophones note; the saved state survived a full refresh. Removed the test bookmark and refreshed again to confirm the original unsaved state was restored. |
| Independent storage check | Bounded read-only inspection confirms exactly one new submitted attempt, owned by a different identity from Admin. Both pre-existing exam-attempt records remain byte-for-byte unchanged. |

The rejection statuses are confirmed in hosted Worker logs. This report intentionally omits account emails, user/attempt IDs, raw question payloads, logs, tokens and personal screenshots.

This is scoped acceptance evidence, not complete security certification. Simultaneous stale Admin tabs, two-device provider/session expiry, exhaustive endpoint mutation testing, hosted backup/restore, phone installation/offline behavior and hosted capacity remain unverified. Existing local authorization and concurrency regression results are retained; no code changed, so those suites were not rerun for this documentation-only update.

Next launch blocker: obtain supported hosted D1/R2 checkpoint/export and isolated restore controls, rehearse recovery in a separate empty target, then record exact schema/data/audit/sequences and PDF bytes/metadata comparisons. No public or privileged recovery endpoint has been added. Keep public release, merge and DNS on hold.

## Recovery capability and target review — 23 October 2026

Rechecked the available Sites operations and storage instructions. Database overview/row inspection is exposed; full hosted SQL export, R2 object export, coordinated checkpoints and isolated restore are not exposed in this session. This is an available-tool limitation, not a claim that the provider has no recovery service. No restore was attempted and no recovery endpoint was added. OPERATIONS_AND_RECOVERY.md now gives the exact provider controls and evidence needed to close this gate.

Native metadata reconfirms private version 11, custom owner/Student-viewer access and 49 application tables. This continuation read no table rows and changed no hosted records, configuration or deployment. Evidence documentation was updated without rerunning unchanged application suites.

The retained public project's returned custom-domain list contains `inspiredinstitute.in` and `www.inspiredinstitute.in`; the requested `myinspiredinstitute.in` is absent from that project's list. Ownership/DNS and other projects were not probed. The future release decision must resolve the intended hostname and target. PUBLIC_RELEASE_PLAN.md now reflects this distinction, version 11, the completed real Student checks and the remaining recovery/device/session/capacity gates. No merge, public publication, production migration or DNS/domain change was performed.
