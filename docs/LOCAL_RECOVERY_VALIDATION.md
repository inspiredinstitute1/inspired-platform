# Local D1 recovery rehearsal — 20 October 2026

Result: **passed on disposable synthetic state**. This is not hosted D1 recovery, a production backup certificate, an in-place database downgrade or hosted R2 recovery. No remote database, deployed site, DNS record or real learner/payment record was modified.

Run after the existing development build:

```sh
npm run test:recovery:local
```

The script accepts no arguments or target overrides. It checks that the built DB binding uses the local placeholder UUID, creates fresh synthetic state through the existing twenty-migration validator, and copies that closed local D1 store into an isolated recovery workspace. Minimal generated configurations contain only that placeholder D1 binding; all Wrangler database commands explicitly use `--local` and have a timeout.

## Validated sequence

1. Apply/reapply the base plus twenty migrations with the existing synthetic fixtures. Retain pending/held/review-approved snapshots, linked payment reviews, evidence decisions, synthetic journal posting/reversal, verification requests/events, module defaults and their audits.
2. Save a synthetic custom module setting before backup. Capture every application table row and SQL schema object, plus foreign-key and integrity checks. Insert and delete synthetic social ID 900001 before the checkpoint.
3. Export SQL using the installed Wrangler local D1 exporter. Record the dump's SHA-256 without altering it.
4. Restore into a separate empty local target. Compare all application tables and all application schema objects exactly, including record values, audit entries, triggers, indexes and views. The manifest also compares every sqlite_sequence name/value; other internal D1 metadata and SQLite objects remain outside the application manifest.
5. Reapply the explicit migrations to the restored target. Confirm records, custom settings, schema and audit history remain unchanged.
6. Change the disposable source after backup. Restore the retained checkpoint into a third empty local target and confirm the post-backup change is excluded. The source database is never overwritten. After exact comparison, both restored targets assign a new social ID above 900001 and give it a separate version-1 create audit.
7. Confirm restored immutable approval snapshots, verification events and module audit history reject delete/update attempts. Pause practice in each recovered database, confirm its module/audit write works, and verify that the database rejects an attempted practice-history mutation.

D1 permits the foreign-key check but rejects `PRAGMA integrity_check` with SQLITE_AUTH. The rehearsal runs integrity_check through Node's read-only SQLite connection only after each local CLI process has closed its D1 connections. It checks the synthetic application database file, not D1's internal metadata store. Export/import and application reads/writes still run through Wrangler's local D1 implementation.

## Evidence and limits

Current successful run after migration 0020: forty-two application tables; exact row/schema/audit round trip; clean foreign keys; SQLite integrity `ok`; preserved records on migration reapplication; successful checkpoint restore and restored guard enforcement.

The script writes the synthetic SQL backup and a hash/count manifest under its disposable `.wrangler/pr3-recovery-*` directory. These are runtime evidence, not a durable or off-site backup. Real backups need encrypted, access-controlled persistent storage and a separately validated hosted recovery procedure. Deleted AUTOINCREMENT high-water marks and post-recovery audit identity are now validated locally. Provider authentication, browser interaction, quotas and recovery under concurrent application traffic remain untested.

Still required before release:

- Real Admin/Student sign-in and gateway-header protection checks.
- Reachable browser/mobile testing in both themes, accessibility, PWA installation/offline behavior and two-device account sessions. No connected local browser is exposed in this session; the earlier cloud preview connection has not been repaired or revalidated.
- An approved isolated staging target with matching code/database/object fixtures. No staging deployment has been authorized or performed in this task.
- Hosted D1 backup/time-travel recovery and migration rollback procedures, R2 object/metadata backup and recovery, operational permission checks and owner approval before production actions.

The original recovery milestone introduced no application changes. The subsequent social/community batch adds migration 0020 and revalidates recovery across forty-two application tables, including restored governance audit protection. The latest application baseline is now 312 tests (including subsequent account-safety and operational checks) and the validated 34-route build/local Worker; lint and type checking pass. Hosted D1 and R2 recovery remain unverified.

## Combined local PDF/object recovery

`npm run test:storage-recovery:local` creates a separate disposable D1/R2 pair, applies the base plus twenty migrations and uploads four generated synthetic PDFs through the application service. Their states cover draft, review, published and archived. A test-only Worker exposes storage inspection/restoration exclusively on loopback with an unpredictable per-run token; it is not referenced by the application build or deployment configuration. It accepts no remote target. All spawned Worker processes are terminated in finally blocks; CLI and HTTP requests have time limits.

The script exports D1 after stopping the source Worker, reads all local R2 pages (two objects per page), saves actual object bytes and records immutable keys, byte lengths, SHA-256, HTTP and custom metadata. It restores the SQL into a new empty local database and the four objects into an empty local bucket. PDF metadata and audit rows compare exactly; re-read bytes and both kinds of object metadata also compare exactly. Generated storage versions, ETags and uploaded timestamps are not treated as recoverable application identity.

Application service checks on the restored state confirm public downloads only for the published PDF and private Admin access to all four statuses. Same-sized corruption with the original hash label is rejected for publication and download. Missing objects fail closed; restoring the original bytes recovers the download. Library pause blocks public delivery while Admin inspection remains accessible; archiving withdraws delivery and retains the stored object.

This exposed an application integrity gap: stored size and hash labels previously passed even if actual bytes changed. Publication and downloads now read and SHA-256-check the actual object against the immutable D1 upload record. Reads are capped by the recorded size and the 5 MiB upload limit, reject truncated/excess/failed streams, and finish before any PDF bytes are returned. This adds bounded buffering and read/hash latency, including a full object read when publishing. It is integrity verification, not PDF parsing or malware scanning. Existing publication/module rechecks still run after the read.

The local files and manifest under `.wrangler/pr3-storage-recovery-*` are disposable test evidence, not durable backups or an operator-approved hosted recovery procedure. Hosted R2 metadata/object recovery, hosted D1 recovery, credentials, permissions, concurrent traffic and recovery objectives remain to be validated on an explicitly approved isolated target.
