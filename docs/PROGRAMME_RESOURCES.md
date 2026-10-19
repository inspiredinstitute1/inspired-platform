# Link free materials to programmes — development only

In the Admin workspace, find **Programme learning materials**:

1. Choose an existing programme record.
2. Choose Note, Video class or Practice test, then select an existing catalogue material authored study note or uploaded PDF.
3. Set the display order. Smaller numbers appear first within that programme.
4. Select whether the material should show when the programme is published, enter a change reason and save.
5. Use **Edit material link** to reorder or hide an existing association. Its programme/resource identity stays fixed; disable it and create a new association to move it.
6. Use **Clear form** to start a different association. This does not remove a saved link.

Students find the links by expanding published programmes in **Explore programmes** on the homepage. Paused/archived programmes and unpublished ancestor branches do not appear. The original free notes, videos and tests remain accessible in their existing library pages. Authored notes must also be Published to appear; archiving a note hides its programme links without deleting them.

Private Admin preview notes cannot be linked publicly. Author new plain-text public notes in the separate Create study notes manager; see `AUTHORED_MATERIALS.md`. Linking does not grant paid access or activate APPX courses. Manual website enrolment records are managed separately; see `ENROLMENTS.md`.

The API is `/api/admin/resources`. `scripts/prepare-portal.mjs` generates the resource metadata from the existing source catalogue. The generated metadata has only IDs, titles, types and internal routes; it is ignored in Git and regenerated before tests/builds. Authored-note and PDF metadata are resolved from D1 at request time. Admin choices include drafts; public resolution includes published notes only.

Explicit migration: `docs/migrations/0005_programme_resources.sql`, after the base and migrations 0001–0004. Local validation runs this migration against a placeholder local D1 database; it has not been applied to remote staging or production.

Link writes require Admin identity, same-origin JSON, valid references, a reason and a matching version for edits. Duplicate associations are rejected. Audit snapshots commit in the same database operation as the link change. Saved links and audit rows are retained; hiding uses a flag rather than deletion.

Remaining verification: actual provider sign-in and browser/mobile interaction. Existing catalogue growth, larger-list search/pagination, and larger-file workflows are later work.

Admin-uploaded PDFs follow the same draft/published resolution rule and download through a controlled route; see `PDF_MATERIALS.md`. Linking a PDF draft does not publish it, and an archived PDF cannot be downloaded publicly even with an old link.
