# PR #3 release review — 20 October 2026

Status: **LOCAL CHECKS PASS; RELEASE BLOCKED**. This document is a review plan, not release approval or a claim that hosted/browser checks passed. PR #3 stays draft. No merge, deployment, DNS, remote migration or live-site change was performed.

## Current evidence

- 312 automated entries pass, zero failures/skips; lint, types, bundle syntax and the 34-route build pass.
- Built Worker checks use synthetic trusted identity headers with disposable local D1/R2. The newly added assertion confirms Admin/Student identity-dependent HTML has `no-store`; the full role smoke passes. This does not prove gateway header protection or provider sign-in.
- Base plus twenty migrations apply/reapply with retained synthetic fixtures and clean foreign keys. Earlier recovery checks preserve 42 application tables, schema, audit and sequence counters/deleted IDs; combined local PDF recovery preserves bytes and HTTP/custom metadata. See LOCAL_RECOVERY_VALIDATION.md.
- The new `npm run audit:release:local` inventories source/build binding names, all migration files and their SHA-256 hashes, requires contiguous migration numbers, and rejects rehearsal flags, a recovery-fixture entry point or static-only packaging. It records the current commit and whether the working tree is clean. The generated manifest lives in a disposable local directory. It runs no tests, migrations, cloud requests or deployment and always leaves releaseReady/releaseApproved/hostedBindingAssignmentVerified false. It is not a full source/archive attestation or independent security audit.
- Fresh registry/frozen-lockfile installation and patched clean-checkout validation now pass on Node 24.19.0/pnpm 11.25.0. The bounded 25-account/four-5-MiB-PDF local rehearsal passes after fixing a small-overflow 413 lifecycle issue. Hosted capacity remains unmeasured. See LOCAL_OPERATIONS_VALIDATION.md.
- The current build has the expected placeholder D1 ID for local checks. This is not evidence that hosted storage has been assigned. Never use that placeholder as a release-target identity.
- Browser extension control is not exposed in this session. The previous cloud preview failed with connection refused and has no repair evidence. No preview was restarted or real browser verification claimed.

## Proposed isolated staging action — awaiting explicit approval

Create one **separate owner-private staging Site** for this draft candidate, using its own new D1 database and R2 bucket. Use an isolated staging checkout and preserve the draft branch’s retained Site identity. Save/deploy this candidate only there; initialize only that isolated target with the base and all twenty explicit migrations. Use synthetic resources/payments and staging-specific test accounts. Keep the existing Site, public domain, GitHub main, DNS, real payments, learner data and external group rosters untouched.

The staging project/database/bucket IDs do not yet exist or have not been selected; verify them after creation and before any target write. Do not reuse the source manifest's existing project ID or any live binding for this proposal. The exact candidate commit will be linked from draft PR #3. Site identity IDs are scoped per Site: test accounts must be identified in the staging Site, not assumed to have their live IDs. Keep FINANCE_REHEARSAL_MODE unset in every hosted environment. Real sign-in requires an authenticated browser; deployment alone cannot complete that verification.

This staging proposal is separate from approval to merge, deploy to the public Site, run production migrations or change DNS. Those still require a later release decision after the results below are reviewable.

## Browser and hosted acceptance matrix

Every row below is **NOT RUN / BLOCKED** until recorded with an actual target, candidate commit, tester/date and result. The local evidence above must not be used to mark these rows passed.

| Area | Check | Required result |
| --- | --- | --- |
| Authentication | Sign in/out as owner and two Student accounts; repeat on another device; test expired/changed sessions | Provider-derived identity; no cross-account state, unauthorized Admin access or unexpected guest import |
| Gateway | Try caller-supplied identity headers without a valid provider session and review protected routes | Hosting boundary ignores/rejects forged identity; app checks alone are insufficient |
| Cache | Navigate/reload/back after sign-out/account switch; inspect HTML/API responses and service-worker caches | Private/no-store identity responses; no personal HTML/API/PDF cached or disclosed to another account |
| Progress | Save offline edits, reconnect, change account in another tab and create same-account version conflicts | Original-account device copy retained; changed account pauses; ordinary conflicts reconcile without silent data loss |
| Mobile/themes | 320/360/390px widths, landscape, black/gold and light themes; long Kannada/English labels | No essential horizontal overflow, clipped Next controls, unreadable labels or overlapping navigation |
| Accessibility | Keyboard-only navigation, focus order/visibility, screen-reader names, errors/status and contrast | Essential actions operable and feedback perceivable; actual findings recorded |
| PWA | Supported Android/browser installation, online/offline transitions, update and saved-account behaviour | Neutral offline fallback; no private caching; no unsupported install claim |
| Materials | Draft/review/publish/archive a text note and PDF; download on phone; disable/re-enable library | Only published resources public; exact download; retained audit; disabled delivery rejected |
| Teaching/enrolment | Two Students, scoped teaching grant, opt-in proposal, return/accept and revoke | Server-enforced scope; acceptance remains unpublished; Admin/Student remain the only base roles |
| Admin/governance | Stale edits, double clicks, failed saves, roster/audit pages and public social destinations | No silent overwrite or duplicate audit; private membership stays private; publication intent reviewed |
| Finance boundary | Synthetic imports/reviews/holds/verification requests; inspect hosted environment flags | No provider authenticity inferred, real posting enabled, rehearsal mode, paid entitlements or external roster changes |
| Hosted storage | Verify target IDs; apply/reapply base + twenty migrations; check FKs, row/audit counts and fixture reads | Separate staging D1/R2 only; no accidental live target or overwritten custom state |
| Hosted recovery | Export/checkpoint, restore into another empty isolated target and compare object bytes/metadata plus SQL state | Matching rows/schema/audit/sequences, retained guards and tested storage recovery; no in-place destructive downgrade |
| Operations | Review Node/dependency installation, resource limits, errors/log privacy, recovery procedure and accountable release owner | Documented findings/limits and unresolved release blockers |

## Explicit migration inventory

These are release inputs, not commands executed remotely. The base migration is `drizzle/0000_far_dust.sql`. Then apply the files below in order to an independently verified, approved target. They remain outside the generated Drizzle journal; GitHub merge alone does not apply them.

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

## Release decision

Only consider public release after the relevant matrix rows pass or a named owner explicitly accepts documented limits. Retain restricted backups and recovery evidence, confirm the exact target/candidate, and obtain explicit approval for merge, deployment, production migrations and any DNS change. Feature requests such as independently verified finance, paid delivery and external community integration are separate scope; do not label them complete because local portal checks pass.
