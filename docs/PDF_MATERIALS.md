# PDF study material — development only

Migration `docs/migrations/0010_pdf_materials.sql` follows the base and nine explicit Admin migrations. The source manifest now declares the optional R2 binding as BUCKET; local Wrangler supplies emulated object storage. This has not provisioned or modified hosted storage. Migration and deployment remain subject to owner approval and staging checks.

## Admin workflow

1. Open Upload study PDFs. Choose a PDF from 32 bytes to 5 MiB, add title, category and a reason, then upload. It always becomes a private Draft, even if an upload submits another status.
2. Download for review through the Admin route. Check the actual document. Format screening validates size, filename/MIME, header and ending; it is not full PDF parsing or malware scanning.
3. Edit PDF details to select Review, Published or Archived with a reason and current version. Published means free to everyone, including signed-out visitors. Publish verifies that the object exists with the saved size and checksum metadata.
4. Students find published files under Free notes → Free PDF study notes. Programme learning materials also offers PDFs as Note choices, marked PDF. Linking a draft does not publish it. Normal programme publication and association visibility also apply.
5. Archive (or return to Draft/Review) to remove future public downloads and programme/enrolment/faculty resource projections. The original object, association and audit remain. Existing downloaded/displayed copies cannot be recalled.

A PDF's file bytes, storage key, original filename, size and checksum are immutable. For corrections, upload a new draft, review/publish it, adjust programme links explicitly and archive the old file when appropriate. Metadata title/category/status can be edited. No existing public catalogue file or private Admin preview is automatically imported or published. Faculty note-submission permission does not allow file uploads or publishing.

## Storage and delivery

`/api/admin/files` lists and manages metadata or accepts multipart uploads. `/api/admin/files/download?id=pdf-…` requires Admin for draft/review/archive downloads. `/api/files` lists only public metadata; `?id=pdf-…` streams a published file or returns 404. Caller-supplied role, status or object-key fields cannot authorize a public download. Storage keys are generated server-side and are not exposed in API listings.

PDFs use private R2 objects, not public bucket URLs. Downloads are application/pdf attachments with safe ID-derived filenames, nosniff, sandbox CSP and private/no-store. The existing service worker excludes all API routes, including these downloads. The server rechecks publication after object fetch. In-flight bytes already delivered and copies already downloaded cannot be recalled. Current size/checksum metadata is checked before streaming; SHA-256 is computed at upload, not recomputed for every streamed download.

The upload route permits at most 6 MiB of multipart request bytes and 5 MiB of actual file data. Ordinary API routes retain their existing transport limits. The portal explicitly appends multipart fields while the pending-save guard disables form controls, avoiding empty uploads. Files are buffered within these bounds; larger files need a different upload design.

New-object storage succeeds before metadata insertion. D1 insertion and its audit are atomic. If saving fails, the application attempts to delete only that newly generated private object. R2 and D1 do not share a transaction; if cleanup also fails, an unreferenced private object can remain. It has no database/public pointer. Reconciliation/cleanup should inspect references before any future removal; there is no automatic deletion of retained archived files.

## Validation and remaining work

Eight service/database tests, three frontend regressions and a bounded transport test cover authorization, format/size rejection, publication/archive, byte delivery, field submission, optimistic conflicts, immutable identity, append-only audit, missing/mismatched storage and cleanup failures. Local Worker/R2/D1 checks verify a synthetic 2.1 MB PDF, rejection/recovery, private Admin download, published download bytes, programme/enrolment visibility and archive retention. Base plus ten explicit migrations pass fresh application, reapplication, row preservation and foreign-key checks.

Provider sign-in and real browser/mobile download behavior remain unverified. Hosted R2 provisioning, object backup/recovery and remote staging are pending. PDF search/bookmarks/completion, richer file formats, larger uploads and private/paid learner delivery remain future work. The current new-PDF section is separate from original catalogue filters and counts.
