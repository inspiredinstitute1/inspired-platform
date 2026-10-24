# Authored study notes — development only

This feature is on draft PR #3 and has not changed the live website. Explicit migration `docs/migrations/0008_authored_materials.sql` follows the base and seven earlier Admin migrations; it is outside the generated Drizzle journal. All validation used disposable local D1 state and synthetic notes.

## Create, review and publish

1. Open Admin → Create study notes. Add a title (120 characters), category (60), plain-text content (20,000) and a reason (3–300). English and Kannada are supported. Save the first version as Draft.
2. Edit the saved note, check the text, and optionally select Review. Review is a private Admin preparation state, not an independent reviewer approval.
3. Select Published and save explicitly to make the note public to everyone, including signed-out visitors. Edits saved while Published update the public text. To work privately, first save as Draft or Review.
4. Public notes appear alongside original notes in Free notes. Open a note to read it. HTML/Markdown markup is displayed as plain text, not interpreted.
5. In Programme learning materials, select Note and the authored note. Draft associations can be prepared early; public programme/enrolment/faculty links appear only while the note is Published. Programme publication and association visibility must also permit display.
6. Select Archived, Draft or Review and save to withdraw future public reads and programme links. Already displayed, copied or downloaded text cannot be recalled. Records, links and audit history remain.

The original free catalogue and private Admin preview notes remain separate. Private previews are not automatically converted or published. Published authored notes are free resources and do not enforce paid/private entitlements or APPX access.

## Protection and history

Admin-only `/api/admin/materials` requires same-origin JSON for writes, enforces a 100 KB encoded-body limit, and trusts only the server session actor. New records must be Draft. Every edit requires the current version; a conflict retains the form text so it can be copied before reloading. Database triggers atomically record full before/after snapshots, disallow physical note deletion and protect append-only history. The UI shows the most recent 50 audit summaries without transferring every snapshot body.

Public `/api/materials` lists only published metadata; `?id=authored-…` returns published text or 404. Public responses omit actor, reasons, versions and private history. No-store requests/responses and existing service-worker API exclusion avoid retaining responses in application caches. UI rendering escapes text and suppresses responses for a reader detached by navigation. DB metadata lookup falls back to the static catalogue only when the authored-material table is absent; other failures propagate instead of returning partial results.

## Validation and remaining scope

Five service/database tests, three frontend regressions, a production build and built Worker/local D1 lifecycle checks pass. Local migration checks apply and reapply the base plus eight explicit migrations with foreign-key and synthetic-row preservation checks. The Worker check exercises longer Kannada text and publication/archive visibility in programme, enrolment and faculty resource views.

Real provider sign-in, browser/mobile interaction and remote staging are unverified. Other file formats/larger uploads, rich text, direct editing of existing notes by faculty, independent revisions for published notes, pagination and full-text indexing remain future work. Published text notes and PDFs now share category filters, metadata search, bookmarks/completion and available counts; see `LEARNING_LIBRARY.md`.

Faculty can submit new course-note proposals only with separate Admin permission. Acceptance creates a new Admin draft and hidden programme association; see `FACULTY_NOTE_REVIEW.md`. Existing private previews and Admin notes are not made editable by faculty.

Admin PDF upload and controlled delivery are implemented separately; see `PDF_MATERIALS.md`. PDFs and text notes share programme-link choices but retain separate editors and immutable file records.
