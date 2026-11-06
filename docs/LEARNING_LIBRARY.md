# Unified learning library — development only

The Free notes screen now combines the original catalogue, published authored text notes, published uploaded PDFs and the account's own private Admin preview notes. Existing preview notes remain private; nothing is automatically converted or published. Draft PR #3 is not deployed.

## Find and save material

Category chips include the categories of currently published material. Search notes and PDFs by title, category and description; authored-note descriptions contain only the first 160 characters. Global search also includes original video/test entries and their existing search fields. This is metadata search, not PDF text extraction or a full-text search index.

Use a card's bookmark, or save from a text/PDF reader. Saved filtering and My progress → Saved for later include new materials. New PDFs open a reader containing the controlled download link and a separate Mark as complete button. Downloading is not a completion event. Authored text readers also offer explicit completion. Student progress remains self-reported learning activity, not verified attendance or paid entitlement.

Guest progress is kept on the device. Signed-in progress uses the existing private account payload, version conflicts and merge behavior. Actual provider authentication and a two-device browser exercise remain release checks; local trusted-header simulations establish application behavior only.

## Withdrawal and unavailable entries

Publishing is checked independently by the metadata, text-content and PDF-download services. Archiving/withdrawing a note removes it from subsequent library reads. Saved/completed IDs already recorded by this account remain valid for its own history and do not restore access to withdrawn text or file bytes. The saved view shows a removable unavailable entry without a retained private title; completed unavailable notes remain in history, outside the available-note completion count.

New dynamic IDs that are draft, unknown or no longer published are uniformly omitted from a progress save, and the response acknowledges their IDs in unavailableResources. This prevents an old guest bookmark/import from blocking otherwise valid account progress. It does not reveal whether an omitted ID exists or why it is unavailable. Another account's history is never used to permit a save. Original catalogue validation and Admin-only private preview rules remain in force.

## Implementation and verification

`/api/library` is a read-only no-store published metadata feed. `?id=authored-…` or `?id=pdf-…` performs a fresh published detail lookup. Responses expose no private audit, role, storage-key or original-filename fields. The browser omits credentials for these public metadata requests and never stores dynamic text/file bodies in progress. Public titles/excerpts are escaped; arbitrary categories do not become CSS class text.

The metadata loader ignores obsolete responses after newer requests/navigation, clears stale dynamic metadata on failure, and restores search focus/selection when refreshing library screens. It never redraws an editor or active test from a late library response. Account window-focus sync also avoids redrawing forms with unsaved input. Original catalogue notes remain available if the new metadata service is unavailable.

No migration was added. Seven service/database tests and eight frontend regressions cover publication/privacy, filters/search, account identity, unavailable history, version conflicts, safe rendering, late responses/focus and explicit PDF completion. Existing local Worker/D1/R2 checks additionally verify save/reload, cross-user isolation, withdrawal retention/removal and omission of unavailable IDs. Base plus ten explicit migrations pass again.

Browser/mobile visual interaction is still unverified: the managed preview supervisor started, but the cloud browser could not connect (ERR_CONNECTION_REFUSED), including after correcting the ignored execution profile. The preview was stopped. Real sign-in, two-device sessions, accessibility/phone downloads, pagination and full-text/PDF indexing remain pending. No merge, deployment, production migration, DNS or live-site changes were made.
