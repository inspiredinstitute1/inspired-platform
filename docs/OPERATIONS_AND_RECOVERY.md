# Operations and recovery — PR #3 development

Status, updated 24 October 2026: private version 12 is deployed; 368 automated tests, TypeScript, production build, core Admin/Student acceptance and the real same-account two-tab conflict recheck are documented as passing. The owner has requested public launch after remaining work, but hosted recovery, production migration review, physical-device/PWA checks and hosted capacity remain open. The 20 October public-target observations below are historical; subsequent synthetic acceptance writes and bounded row inspection occurred only in the separate private candidate. No public database was exported, changed, migrated or restored. Metadata inspection is not a backup or a security audit.

Current private staging: 49 application tables and 232 expected schema objects from the base plus 22 explicit SQL migrations. The public DB overview still lists only `learner_progress`. Do not deploy Version 3 to the public Site until its migration history and recovery point are verified.

## Supported recovery capability check — 23 October 2026

Rechecked the available native Sites operations and the Sites storage instructions. The exposed database controls are overview and bounded table-row inspection. No operation for full hosted SQL export, coordinated checkpoints, R2 object export or isolated restore is exposed in this session. The storage instructions describe bindings and immutable applied migrations, not a backup/restore workflow. This establishes an available-tool limit; it does not establish that the hosting provider has no internal recovery service.

The private target remains `appgprj_6ad6d873b0288191b0ac6e3215524ee6`, Sites version 12, Worker source `b25d2aa67076b922b5a4f0715ab312657e8f2303`. Native metadata confirms custom restricted access for the existing owner and invited Student viewer, and an untruncated overview contains 49 application tables in DB. This check read no table rows or object bytes, created no backup or recovery target, and changed no deployment, audience, environment variable or migration.

Bounded row inspection cannot replace a backup: it does not provide complete SQL definitions, sequence counters, migration history, an atomic checkpoint or the referenced R2 bytes and metadata. Source archives and prior Worker versions do not contain the application database or uploaded PDFs. The local 49-table/four-PDF recovery evidence is retained separately and does not satisfy hosted recovery.

### Provider handoff required to close recovery

| Required supported control or evidence | Acceptance condition |
| --- | --- |
| Exact managed D1/R2 identity and recovery operator | The provider maps DB and BUCKET to the selected private project, identifies who can export/restore, and confirms an empty isolated restore target. Do not assume the user's separate Cloudflare account controls these managed resources. |
| Full SQL export/checkpoint and migration history | Schema, rows, immutable audits, sequence counters and applied migration history are retained; UTC checkpoint and write/quiescence interval are recorded. |
| Complete R2 export and inventory | Every object-list page is followed; exact keys, lengths, SHA-256, HTTP metadata and custom metadata accompany the bytes. |
| Restricted durable retention and recovery access | The provider/operator records retention, access, encryption, recovery access and agreed recovery-point/time objectives. No SLA is inferred before agreement and measurement. |
| Restore into a separate empty target | Full schema/data/audit/sequence comparisons, foreign-key/integrity checks, PDF hash/metadata comparisons and application privacy/guard checks pass; elapsed recovery time and discrepancies are recorded. |

Next executable step is to obtain these supported controls through the hosting operator. Do not add an application SQL/export/restore endpoint, reuse a sign-in bypass token as provider access, invent hidden API routes, create an unused recovery Site or attempt an in-place restore. No export, restore or provider support message was sent as part of this capability check.

The public project's currently listed domains were also inspected read-only: `inspiredinstitute.in` and `www.inspiredinstitute.in`. The requested `myinspiredinstitute.in` is not in that project's returned domain list. This is not a DNS ownership lookup or evidence about other projects. Resolve the intended hostname and exact target in the eventual public-release decision; no domain/DNS change was made.

On 23 October the owner confirmed `inspiredinstitute.in` as the intended public domain. The hostname question is resolved. The owner has since requested public launch after the remaining work; the open recovery, migration, device and capacity gates still prevent a safe release. Private version 12 (`b25d2aa67076b922b5a4f0715ab312657e8f2303`) fixes a browser initialization alias that could drop a first bookmark during a competing-tab save. The real hosted 409/retry case now preserves the other tab's weekly goal and the bookmark through reload. The original Student payload was restored and the Admin row was unchanged. See RELEASE_CANDIDATE_2026_10_23.md for the scoped evidence. No schema migration or recovery control was introduced.

## Read-only hosted observations — 20 October 2026

The exact Site ID retained in `.openai/hosting.json` was inspected through Sites metadata/configuration/database-overview tools. The selected Site is active/public and reports `https://inspiredinstitute.in` as its live URL. `inspiredinstitute.in` and `www.inspiredinstitute.in` both report active domain/SSL status. This confirms hosting metadata, not a browser, DNS lookup or gateway penetration test. Direct public HTML inspection was unavailable in this session, so no published link destinations or ownership were verified.

The bounded live database overview reports binding DB and only the application table learner_progress; no identifiers were omitted. PR #3's additional schema is therefore not established there. No table rows were requested. A PORTAL_ADMIN_EMAIL secret key exists, but its value is masked and correct configuration cannot be inferred. The returned configuration includes no FINANCE_REHEARSAL_MODE or REHEARSAL_TOKEN setting. No configuration value or token is retained in this repository.

Important migration distinction: `drizzle/0000_far_dust.sql` creates learner_progress without IF NOT EXISTS. Use the base only for a fresh empty target, or let the supported migration journal determine that it is already applied. Do not manually replay the base against the existing live table. After a supported backup and verified migration-history review, apply only the confirmed missing files from the 22-file explicit SQL inventory in `PR3_RELEASE_REVIEW.md` through a supported target-specific workflow; merely uploading this Worker or merging GitHub does not prove those files ran. Reconcile migration history before a platform deployment because a failed deployment can still have applied schema changes.

## Admin readiness panel

Development adds read-only `/api/admin/operations` and a System readiness panel. Anonymous and Student requests receive 403 before schema or storage probes. Version 12's readiness catalogue checks expected schema-object names/types generated from the base plus 22 explicit SQL migration files (232 expected objects) and performs one R2 HEAD against a reserved diagnostic key. It reads no learner/payment/content rows and creates no object. POST/DELETE and other service mutations return 405.

A complete schema-name inventory plus working storage HEAD returns 200; missing bindings/objects, read failures, more than 1000 returned schema objects or any synthetic rehearsal setting returns 503. The earlier local role-smoke result below was from the 20-migration/208-object catalogue and is historical; it must not be used to characterize current hosted readiness. Version 12 reports its 22-migration/232-object catalogue separately. The generated catalogue's fingerprint identifies expected source SQL, not verified database SQL definitions. Existence of a name does not validate its columns, trigger body, data integrity or migration history.

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
