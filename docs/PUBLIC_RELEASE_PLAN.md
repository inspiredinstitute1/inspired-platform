# Public release plan — pending approval

Prepared 20 October 2026; updated 23 October after real Student acceptance and the supported recovery capability check. This is a review plan, not authorization to deploy publicly, change a database, merge, change access or change DNS.

## Targets

- Retained public project: appgprj_6ad2e15a9cb481918e728ea9c3075998. Its domain list, inspected read-only on 23 October, contains `inspiredinstitute.in` and `www.inspiredinstitute.in`. The user's requested `myinspiredinstitute.in` is absent from this project's returned list. Confirm the intended hostname and target before preparing public publication; no domain/DNS changes are authorized.
- Private candidate project: appgprj_6ad6d873b0288191b0ac6e3215524ee6, https://inspired-pr3-private-staging-20261020.faceacademy01.chatgpt.site. It has separate DB/R2 and custom restricted access for the existing owner and invited Student viewer.
- Deployed private candidate: Sites version 11, Worker source `dbc1d08d84cdbf293c14ae25c6cb38c4e3bbfed4`. Subsequent evidence-only GitHub commits do not change this deployed Worker.
- Draft GitHub PR #3: development/inspired-3-modular-platform-2026-10-19. GitHub main is not the private-site source branch.

The 20 October read-only public schema observation contained learner_progress only; it is not a fresh migration-history inspection. The 23 October private database overview contains 49 application tables. A successful private deployment does not make public schema migration complete.

## Prepare before requesting final release approval

1. Record the exact proposed source commit and saved artifact, public target, current deployed version and current migration history. Keep private test banners and synthetic fixtures out of the public candidate. Preserve the target's existing audience unless the owner explicitly approves a change.
2. Retain the completed separately authenticated Admin/Student core acceptance in RELEASE_CANDIDATE_2026_10_23.md. Preserve the existing private allowlist. Concurrent stale-account tabs, expired sessions and two physical devices still need evidence; ordinary separate-account acceptance does not close those cases.
3. Retain the real Student 403/404 permission/isolation checks and hosted unauthenticated forged-header rejection. Verify remaining provider/session cases through supported controls; these bounded checks are not complete gateway penetration testing.
4. Obtain supported hosted DB export/checkpoint and R2 recovery controls. The available Sites tools expose inspection, not a full backup/restore operation. Follow the provider handoff and separate-empty-target acceptance conditions in OPERATIONS_AND_RECOVERY.md. A storage HEAD, table-row listing, source archive or local rehearsal does not satisfy this check. Do not place real learner backups or private question banks in GitHub or add a privileged application recovery endpoint.
5. Reconcile public migration history before applying schema. The base migration creates learner_progress without IF NOT EXISTS; do not replay it over the existing public table. The private combined migration journal is specific to its test history. Do not copy it blindly into the public target. Apply only the confirmed missing migrations through the supported target-specific workflow after backup and approval.
6. Review provider request/CPU/memory/database/storage limits against the expected learner load. Record measured hosted behavior and available capacity; local timings are not a hosted service guarantee.
7. Review mobile, accessibility and PWA evidence, including its listed limits, and the published content/access states for the initial release. Verify actual phone installation separately if installation is part of the launch promise.
8. Present the owner with the exact version/commit, scope of migrations, expected interruption, recovery checkpoint and rollback procedure. Obtain explicit public-release approval.

## Proposed release sequence — only after explicit approval

After approval only: apply the approved target-specific migration/source workflow, save the exact public artifact, deploy once, inspect the returned deployment status, and perform bounded smoke checks. Do not change DNS when existing custom domains already point to the selected public Site. A merge requires its own authorization if it is not explicitly included in release approval.

If publication fails, inspect both deployment and migration state before retrying; database migrations may have executed even if the application publication failed. Application rollback does not undo schema or data changes. Prefer backward-compatible schema additions and forward fixes; never drop learner data as a rollback shortcut.

## Evidence already available

- 367 automated tests, TypeScript and production Worker build pass; the built HTTP transport accepts a 250-question preview.
- Private version 11 is deployed with full-paper CSV/JSON imports, mobile exam navigation, account-bound writes, explicit start/final-submit confirmations and private analytics.
- Real Admin browser acceptance covers review/draft/publication, paid-code controls, refresh/resume, mixed-answer scoring and exclusion of owner practice from cohort analytics.
- Separate real Student acceptance covers Admin/cross-account denial, fresh attempt, refresh/resume, exact 4/10 scoring, own-only analytics and durable note bookmarking. See RELEASE_CANDIDATE_2026_10_23.md for exact observations and limits.
- Local recovery passes 49 application tables and four PDFs with exact bytes/metadata; local concurrency passes 25 synthetic accounts and competing writes. These do not establish hosted recovery/capacity.
- Inspected responsive widths and both themes supplement MOBILE_ACCESSIBILITY_PWA_2026_10_20.md. Physical-phone install/relaunch, offline, screen-reader and two-device checks remain open.

All pending items must be assessed honestly. This plan does not claim that hosted backups, gateway security, payment-provider verification or a public launch have passed.
