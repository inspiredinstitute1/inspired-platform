# Ten-step PDF recovery batch — 20 October 2026

Development only on draft PR #3. No merge, deployment, remote migration, DNS change, live-site edit or real learner/payment operation.

| Step | Delivered and validated |
| --- | --- |
| 1 | Extended the local D1 snapshot to capture every AUTOINCREMENT sequence counter alongside the 42 application tables and SQL objects. |
| 2 | Inserted/deleted synthetic social ID 900001 before backup. Both recovered databases allocate a greater ID with its own version-1 create audit. Native local export/import preserves the high-water mark without modifying the dump. |
| 3 | Added a repeatable local storage recovery command with no target arguments, placeholder DB checks, disposable directories, loopback/token-only fixture Worker and bounded subprocess/HTTP lifetimes. The fixture is outside application routing/build configuration. |
| 4 | Created four genuine generated PDF objects through the application upload service, covering draft, review, published and archived metadata states. |
| 5 | Exported D1 after stopping the source Worker and backed up paginated local R2 bytes, immutable keys, SHA-256, content type and custom metadata into a disposable manifest/checkpoint. |
| 6 | Restored D1 and objects into separate empty local targets. Exact PDF rows/audits, object inventory, bytes, hashes and HTTP/custom metadata match. Storage-generated versions/timestamps are outside the identity guarantee. |
| 7 | Verified restored public published delivery and private Admin delivery; draft/review/archive remain unavailable publicly. Missing-object rejection and restoring original bytes pass. |
| 8 | Fixed a discovered integrity gap: publication/download previously trusted the hash label. Both now SHA-256-check actual bytes before proceeding, reject short/excess/failed streams and bound reads to the recorded length and 5 MiB limit. Same-sized corruption retaining its original hash label cannot be published/downloaded. |
| 9 | Verified recovered library pause/re-enable and archive guards through application services on local D1/R2. Admin can inspect during a pause; archive retains the object and denies public delivery. |
| 10 | All 288 tests, lint, types, bundle syntax, 34-route build, built-Worker role smoke and local recovery checks pass. Base plus twenty migrations apply/reapply with retained synthetic data and clean foreign keys. Updated recovery/material/remaining-work reports accompany the draft PR changes. |

Two new automated regression entries cover same-size corruption and short/excess/failed object streams. A successful local storage integration verifies four objects; the separate database integration verifies all 42 application tables, sequence counters, migration reapplication, checkpoint recovery, integrity and retained governance/finance/module/practice guards. No new migration or dependency is required.

Actual-byte verification buffers a PDF before delivery and adds bounded memory/read/hash latency. It is not PDF parsing or malware scanning. Hashes verify consistency against the D1 upload record; the disposable unsigned manifest is not independent authenticity evidence or a durable backup.

Still pending: provider sign-in/gateway protection, browser/mobile/accessibility/PWA/two-device QA, approved hosted staging and D1/R2 recovery, provider evidence and real payment reconciliation/entitlements, and owner-approved release. No readiness percentage is inferred from this batch.
