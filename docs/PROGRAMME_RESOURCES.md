# Link free materials to programmes — development only

In the Admin workspace, find **Programme learning materials**:

1. Choose an existing programme record.
2. Choose Note, Video class or Practice test, then select an existing material.
3. Set the display order. Smaller numbers appear first within that programme.
4. Select whether the material should show when the programme is published, enter a change reason and save.
5. Use **Edit material link** to reorder or hide an existing association. Its programme/resource identity stays fixed; disable it and create a new association to move it.
6. Use **Clear form** to start a different association. This does not remove a saved link.

Students find the links by expanding published programmes in **Explore programmes** on the homepage. Paused/archived programmes and unpublished ancestor branches do not appear. The original free notes, videos and tests remain accessible in their existing library pages.

Private Admin preview notes cannot be linked publicly. This feature does not upload or author material, grant paid access or activate APPX courses. Manual website enrolment records are managed separately; see `ENROLMENTS.md`.

The API is `/api/admin/resources`. `scripts/prepare-portal.mjs` generates the resource metadata from the existing source catalogue. The generated metadata has only IDs, titles, types and internal routes; it is ignored in Git and regenerated before tests/builds.

Explicit migration: `docs/migrations/0005_programme_resources.sql`, after the base and migrations 0001–0004. Local validation runs this migration against a placeholder local D1 database; it has not been applied to remote staging or production.

Link writes require Admin identity, same-origin JSON, valid references, a reason and a matching version for edits. Duplicate associations are rejected. Audit snapshots commit in the same database operation as the link change. Saved links and audit rows are retained; hiding uses a flag rather than deletion.

Remaining verification: actual provider sign-in and browser/mobile interaction. Existing catalogue growth, larger-list search/pagination, and new material authoring are later work.
