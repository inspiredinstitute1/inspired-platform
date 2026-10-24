# PR #3 release review — 24 October 2026

Status: **PRIVATE CANDIDATE VALIDATED; PUBLIC RELEASE BLOCKED BY OPEN OPERATIONAL GATES.** The owner has requested public launch after the remaining work. This request does not close recovery, capacity, device or production-schema checks. Do not deploy to production while those checks are open.

## Current targets and state

- PR #3 is still draft/open; private staging is Sites version 12 at the existing restricted URL. Version 12 uses source `b25d2aa67076b922b5a4f0715ab312657e8f2303`. The staging audience remains the existing restricted owner/Student-viewer allowlist.
- The intended public hostname is `inspiredinstitute.in`, already attached to the retained public Site. No DNS change is needed for that hostname.
- The public Site remains unchanged. Its read-only D1 overview currently exposes only `learner_progress`; the private staging database exposes 49 application tables. Do not deploy the Version 3 Worker to the public Site until its exact migration history and recovery point are verified.
- No production migration, merge, public deployment, database write or DNS change was performed in this review.

## Validation completed

- 368 automated tests pass with zero failures/skips on the version-12 source; TypeScript and the production Worker build pass.
- The new two-tab regression exercises actual initialization for online and cached starts and first additions/removals. It failed against the prior code and passes after independent deep copies of initial state and the sync baseline.
- Real hosted Student two-tab testing produced the expected progress conflict (HTTP 409), then preserved both the newer weekly goal and the older tab's bookmark through reload. Test state was restored; the Admin row remained unchanged.
- Earlier real Admin and Student acceptance covers import/review/publication, account isolation, Admin denial, timed exam refresh/resume, exact scoring, own-only analytics and paid-code controls.
- Local recovery covers 49 application tables and four synthetic PDFs with byte and metadata comparisons. Local concurrency covered 25 synthetic accounts. Neither establishes hosted recovery or capacity.

## Open public-release gates

| Gate | Current status |
| --- | --- |
| Hosted D1/R2 backup and restore | Open. The connected Sites tools expose overview and bounded row inspection, not full SQL/R2 export, checkpoint or isolated restore. |
| Production migration plan | Open. Reconcile the public migration journal and existing `learner_progress` table; do not replay the base migration. Run only verified missing migrations after a supported backup and target-specific validation. |
| Account/session coverage | Partially open. Core separate Admin/Student and same-account two-tab tests passed; stale Admin/account-switch tabs, expired provider sessions and two physical devices remain unverified. |
| Physical-device/PWA/accessibility | Open. Desktop responsive checks and service-worker tests do not establish physical phone install/relaunch, offline behavior or screen-reader behavior. |
| Hosted capacity/operations | Open. Local timings do not establish hosted quotas, cold starts or capacity. |
| Public launch | Requested by the owner, but blocked until the technical gates above are resolved or their specific limits are explicitly accepted. |

## Explicit SQL migration inventory

These are release inputs, not commands executed remotely. The base migration is `drizzle/0000_far_dust.sql`; it creates `learner_progress` without `IF NOT EXISTS` and is for an empty target only. Then reconcile and apply the 22 explicit SQL migrations below, in order, through a supported target-specific workflow. Do not copy the private staging journal blindly to production.

| Order after base | File |
| --- | --- |
| 01 | `docs/migrations/0001_social_links.sql` |
| 02 | `docs/migrations/0002_community_membership.sql` |
| 03 | `docs/migrations/0003_finance_reconciliation.sql` |
| 04 | `docs/migrations/0004_content_manager.sql` |
| 05 | `docs/migrations/0005_programme_resources.sql` |
| 06 | `docs/migrations/0006_programme_enrolments.sql` |
| 07 | `docs/migrations/0007_faculty_assignments.sql` |
| 08 | `docs/migrations/0008_authored_materials.sql` |
| 09 | `docs/migrations/0009_faculty_note_review.sql` |
| 10 | `docs/migrations/0010_pdf_materials.sql` |
| 11 | `docs/migrations/0011_finance_import_staging.sql` |
| 12 | `docs/migrations/0012_finance_review.sql` |
| 13 | `docs/migrations/0013_finance_evidence_decisions.sql` |
| 14 | `docs/migrations/0014_finance_payment_links.sql` |
| 15 | `docs/migrations/0015_cross_batch_payment_links.sql` |
| 16 | `docs/migrations/0016_finance_approval_snapshots.sql` |
| 17 | `docs/migrations/0017_finance_rehearsal_journal.sql` |
| 18 | `docs/migrations/0018_finance_verification_requests.sql` |
| 19 | `docs/migrations/0019_portal_module_controls.sql` |
| 20 | `docs/migrations/0020_social_community_audit.sql` |
| 21 | `docs/migrations/0021_paid_mock_exams.sql` |
| 22 | `docs/migrations/0022_complimentary_mock_codes.sql` |

## Scope limits

Paid-code issuance remains a manual owner payment confirmation; no PhonePe/APPX/Razorpay verification adapter or real finance posting/reconciliation is enabled. This does not block the agreed free-learning and APPX-routing scope, but it must not be presented as automated payment verification.

After the open technical gates are closed, deploy the exact verified artifact to the retained public Site, inspect the returned deployment status, and run bounded smoke checks. Keep the existing public audience and hostname. Never use an in-place restore or a reverse migration as a routine rollback.
