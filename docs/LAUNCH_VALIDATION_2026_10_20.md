# Launch validation — 20 October 2026

Candidate: private-site version 6, source de7da8193169f7a794566648ccebbb460efb7051. This document records development evidence; it does not approve a public launch.

## Completed

- 345 automated tests, TypeScript checking, lint and application build passed before saving version 6.
- Private deployment succeeded. Browser inspection confirmed analytics navigation, honest empty-evidence states, Admin import controls and no captured browser errors. Hosted readiness reported 21 expected migration files, 227 schema objects and readable PDF-storage metadata.
- Fresh disposable local D1: base plus 21 explicit migrations applied; reapplication preserved synthetic records, foreign keys and row counts.
- Full built Worker role/runtime suite passed. Its new mock journey creates and publishes a synthetic paid paper, checks locked access, binds a code to the learner email, rejects another account and replay, starts an attempt, saves and resumes without resetting the deadline, rejects cross-account reads, submits and verifies +1/-0.25 grading. Populated subject/topic SWOT and focus recommendations are verified through HTTP routes. Admin owner practice is excluded from cohort reports.
- Local D1 export/restore rehearsal passed for 48 tables: exact rows, schema, audits, sequences, deleted-ID safety, integrity, repeatable migrations, immutable/practice guards and checkpoint restore into fresh targets.
- Local D1/R2 recovery rehearsal passed with four synthetic PDFs: keys, bytes, hashes, HTTP/custom metadata, PDF records/audits, privacy states and corruption/missing-object rejection.
- Candidate input audit passed: declared bindings agree and application build has no rehearsal flags. It intentionally does not approve release.

The local runtime role suite previously omitted migration 0021; it now includes it and exercises the mock journey. This was a verification-script gap, not an observed deployed application failure.

## Boundaries and remaining work

The local runtime uses simulated trusted identity headers and synthetic payment confirmation. It proves application behavior under those inputs, not provider sign-in, gateway header protection or actual payment receipt. Local recovery does not establish hosted backups or hosted restore capability.

Before public launch:

1. Complete the private hosted journey with a real, separate Student sign-in, an approved test paper and test access code. Verify account isolation, refresh/timer/submission and populated reports. Owner-only Site access currently prevents a separate learner from entering until a separately approved sharing/test arrangement is made.
2. Check smartphone layouts, keyboard/accessibility behavior and install/offline behavior. An offline app shell is not offline exam synchronization.
3. Confirm the supported hosted backup/recovery procedure, target migration history and provider capacity/quotas. The public Site and private candidate have different databases; private schema success does not migrate the public database.
4. Review the exact public release target and migration plan, then obtain owner approval before public deployment, DNS or merge changes.

No real learner records, payment data, private question banks, credentials or backups are included in this report. This verification pass changed no hosted records or configuration.

## Reproduce locally

Use the built local Worker with placeholder DB/R2 bindings. The scripts enforce local targets:

- node scripts/validate-local-d1.mjs
- node scripts/smoke-local-worker.mjs --roles
- node scripts/validate-local-recovery.mjs
- node scripts/validate-local-storage-recovery.mjs
- node scripts/audit-release-inputs.mjs

The runtime suite's synthetic access-code issuance is confined to disposable local state and does not issue a real learner code.
