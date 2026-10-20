# Operations and recovery — PR #3 development

Status: runbook prepared; hosted restore, automated monitoring and release are **not performed or approved**. No live records were read/exported, changed, migrated or restored. The read-only hosting metadata observations below are not a backup or a security audit.

## Read-only hosted observations — 20 October 2026

The exact Site ID retained in `.openai/hosting.json` was inspected through Sites metadata/configuration/database-overview tools. The selected Site is active/public and reports `https://inspiredinstitute.in` as its live URL. `inspiredinstitute.in` and `www.inspiredinstitute.in` both report active domain/SSL status. This confirms hosting metadata, not a browser, DNS lookup or gateway penetration test. Direct public HTML inspection was unavailable in this session, so no published link destinations or ownership were verified.

The bounded live database overview reports binding DB and only the application table learner_progress; no identifiers were omitted. PR #3's additional schema is therefore not established there. No table rows were requested. A PORTAL_ADMIN_EMAIL secret key exists, but its value is masked and correct configuration cannot be inferred. The returned configuration includes no FINANCE_REHEARSAL_MODE or REHEARSAL_TOKEN setting. No configuration value or token is retained in this repository.

Important migration distinction: `drizzle/0000_far_dust.sql` creates learner_progress without IF NOT EXISTS. Use the base only for a fresh empty target, or let the supported migration journal determine that it is already applied. Do not manually replay the base against the existing live table. After backup and approval, the twenty explicit Admin files must be applied through an available supported target-specific workflow; merely uploading this Worker or merging GitHub does not prove those files ran. Reconcile migration history before a platform deployment because a failed deployment can still have applied schema changes.

## Admin readiness panel

Development adds read-only `/api/admin/operations` and a System readiness panel. Anonymous and Student requests receive 403 before schema or storage probes. GET checks the names/types of the expected 208 tables/indexes/triggers/views generated from the base plus twenty migration files and performs one R2 HEAD against a reserved diagnostic key. It reads no learner/payment/content rows and creates no object. POST/DELETE and other service mutations return 405.

A complete schema-name inventory plus working storage HEAD returns 200; missing bindings/objects, read failures, more than 1000 returned schema objects or any synthetic rehearsal setting returns 503. The local role smoke deliberately enables the synthetic finance rehearsal, so its expected diagnostic result is 503 with only that configuration issue; all 208 objects are present and R2 HEAD succeeds. The generated catalogue's fingerprint identifies expected source SQL, not verified database SQL definitions. Existence of a name does not validate its columns, trigger body, data integrity or migration history.

The response never prints secret values, raw SQL exceptions, real learner data or bucket keys. It always reports release readiness, backup verification, provider/gateway verification, hosted capacity, storage-write and recovery verification as false. An HTTP 200 from these narrow checks must not be described as complete operational readiness. The panel displays 503 findings, escapes diagnostics and ignores stale responses after newer loads/navigation.

This is a manually triggered Admin diagnostic, not a scheduled uptime monitor, external alert service or verified hosted installation. No alert recipients, schedules or credentials were created. Future monitoring must use an approved service or supported authenticated owner access; never publish an Admin bypass token or spoof identity headers in a monitoring job.

## Backup/checkpoint procedure — execute only on an approved target

1. Confirm the candidate commit, Site/database/bucket IDs, owner, access policy and whether the target is empty staging or existing production. Record the schema/migration history; never select targets from a friendly name alone. Set recovery point/time goals, retention, storage location and an accountable operator before claiming an SLA.
2. Use the provider-supported export/checkpoint facility with appropriate access. The tools exposed in this session provide database overview/row inspection, not a complete SQL export, R2 backup or restore operation. Obtain supported platform/provider controls rather than building a public SQL/export backdoor.
3. Coordinate a stable checkpoint across D1 metadata and referenced PDF objects. Record the write/quiescence interval and any excluded post-checkpoint writes. Database export can block other requests; plan its operational impact. Do not assume D1 and R2 have a shared atomic snapshot.
4. Store full SQL schema/data/audit and sequence counters plus an object manifest: immutable key, exact length, computed SHA-256, HTTP metadata and custom metadata. Follow every object-list cursor. A download folder of PDFs alone is insufficient for this application's immutable upload identity/hash metadata.
5. Keep backups access-restricted and encrypted in an approved durable location with separately managed recovery access. Record artifact hashes, UTC checkpoint time, candidate/schema versions and who validated them. Do not store real backups, private invitation links, payment evidence or credentials in GitHub or these reports.
6. Restore the retained SQL and object manifest into another empty isolated target first. Compare all rows/schema/audit/sequences, foreign keys and PDF bytes/metadata. Validate draft/review/archive privacy, module/revocation guards and deleted-ID allocation. Record results and recovery duration. Local rehearsal evidence is available in LOCAL_RECOVERY_VALIDATION.md; it does not establish hosted success.
7. For production incidents, obtain explicit incident-specific approval before an in-place restore. Record the current checkpoint before any destructive action, the write-loss window and compensating recovery path. Revalidate target identity, app/schema compatibility and post-restore access/financial/community invariants. Never use reverse migrations or an old Worker blindly as a complete data rollback.

Cloudflare documents D1 Time Travel as an in-place operation that overwrites state and cancels in-flight work; it is not a clone-to-new-target facility. Actual history availability depends on the storage backend/plan and must be verified for this managed Site. Prefer isolated SQL/object restoration for the rehearsal above. These statements are documentation checks, not evidence that this Site's provider access or history has been verified.

Sources checked 20 October 2026:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

R2's API supports HTTP/custom metadata on writes and cursor-based listing; the restore procedure must explicitly preserve the application's needed fields. D1's SQL export/import is a separate mechanism from Time Travel. No remote command from these references was run.

## Incident/monitoring response

| Signal | First permitted action | Before a hosted write |
| --- | --- | --- |
| Missing schema / Admin API errors | Record status, candidate and expected migration list; inspect supported metadata | Backup and confirm journal/pending SQL plus target-specific approval |
| PDF storage read failure or mismatched bytes | Retain the object/metadata, record affected synthetic/reference ID privately; check binding/provider status | Validate the checkpoint/object identity; approve repair/restore separately |
| Unsafe rehearsal configuration | Record setting name only and keep release blocked | Owner-approved configuration correction; do not emit the value |
| Authentication or private-data concern | Preserve minimal redacted evidence and review the hosting access boundary | Owner/incident approval for configuration changes and any data recovery |
| Capacity/latency failure | Compare provider measurements with the local bounded rehearsal; review CPU/memory/request/storage quotas | Approve any plan/configuration changes; local timing is not a hosted SLA |

## Remaining evidence

Actual provider sign-in/header sanitization, hosted toolchain/quotas/cold starts, platform backup/export permissions, coordinated hosted D1/R2 restore, monitoring/alert delivery and owner-approved release remain open. Public/social ownership checks are not established by SSL or a validated URL. Payment/community work needs the independent inputs in PROVIDER_AND_COMMUNITY_READINESS.md.
