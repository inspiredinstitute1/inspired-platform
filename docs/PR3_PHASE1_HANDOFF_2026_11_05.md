# PR #3 — Phase 1 code-level completion and handoff (5 November 2026)

**Scope:** development-only review, automated checks and release documentation. This is **not** approval to merge, deploy, migrate, change DNS or alter hosted records.

## Confirmed development evidence

- Draft PR #3 targets `main` and remains open and unmerged.
- The non-deploying workflow `.github/workflows/pr3-validation.yml` uses frozen dependencies and runs portal preparation, account-binding tests, the full test suite, TypeScript, lint and production build. It has read-only repository permission and no deployment step.
- GitHub Actions run [#24](https://github.com/inspiredinstitute1/inspired-platform/actions/runs/41960453128) completed successfully on commit `6a4bd060`.
- Recent security regressions include nested progress payload validation, Admin authorization and origin checks, Admin exam account binding, early resource write rejection and synthetic cross-student exam-attempt read/write isolation.
- Code inspection confirms student exam attempt reads and writes are constrained by authenticated `learner_id`; writes additionally use optimistic version checks and recheck access. This is source-level evidence, not a live identity-provider penetration test.
- Earlier local database, Worker, R2-object recovery and concurrency evidence is documented in `docs/PR3_DEVELOPMENT_VALIDATION.md`. These are **local** checks and cannot substitute for hosted backup/restore or load tests.

## Phase 1 sign-off boundary

The present evidence supports **completion of the agreed bounded code-level review and CI verification**, not a claim of exhaustive security assurance. CI does not run every historical local integration, migration, recovery or accessibility command. New changes after `6a4bd060` require fresh CI verification. A separate human review may still identify issues.

## Phase 2 prerequisites — hosted data protection

1. Recover and verify authoritative Sites access, D1 target identity and R2 namespace/bucket access. Do not create replacement infrastructure.
2. Capture a supported, restorable **hosted** D1 checkpoint/export and R2 object inventory/backup with key, bytes and metadata integrity.
3. Demonstrate isolated restore with record/object counts and integrity checks. Never restore over live production as a test.
4. Reconcile the production-specific schema and migration sequence before any application or database rollout. The base `learner_progress` migration must not be replayed blindly on an existing production table.

## Phase 3 prerequisites — hosted acceptance

- Owner/Student real-session, stale-session, account-switch and expired-session/two-device tests.
- Physical Android/PWA and screen-reader accessibility checks.
- Hosted capacity/quota and failure-mode validation, with safe test accounts and no uncontrolled production load.
- Staging acceptance for Admin and Student workflows, including mock exams, privacy, PDFs, enrolments and finance evidence.

## Phase 4 — release control

Obtain explicit owner authorization **after** Phases 2–3 evidence is reviewed. Keep PR #3 draft, `main`, public Site, DNS, hosted D1 and R2 unchanged until that authorization. Maintain rollback and recovery instructions. Manual paid-code records do not establish independently verified payment.

## Next action

Begin with provider/hosting access verification and a read-only hosted resource inventory; do not run migrations or write to hosted data.
