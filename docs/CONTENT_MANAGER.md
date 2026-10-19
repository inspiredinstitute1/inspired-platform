# Programme and Module Manager — development milestone

This feature is on draft PR #3. It is not deployed to the live website.

## Admin workflow

1. Open the Admin workspace and find **Programme & Module Manager**.
2. Create a Division first, then choose it as the parent when creating a Course.
3. Add Subjects under a Course and Modules under a Subject. Test Series can sit under a Course or Subject; Tests can sit under a Module or Test Series.
4. Enter a title, optional description, display order and a reason for the change. Smaller order numbers appear first among siblings.
5. Start in Draft or Review. Publish each parent before publishing its children.
6. Use **Edit programme** to rename, reorder, move to another valid parent or change status. The record type remains fixed; archive a mistaken record and create the correct type.
7. Pause or Archive to hide a record and its branch from Explore programmes. Records and previous learner progress remain intact. Republishing an ancestor restores descendants that are still Published.
8. Expand **Recent programme changes** to view the latest 50 changes, with the actor, timestamp and reason. The database retains before/after snapshots for all changes.

Use the Programme learning materials panel to link existing free notes, videos and tests; see `PROGRAMME_RESOURCES.md`.

The programme list is empty initially. No sample programme is published automatically. Existing free notes, videos and practice tests remain available independently.

## Technical validation

Explicit development migration: `docs/migrations/0004_content_manager.sql`.
It is outside the generated Drizzle journal, like the earlier Admin migrations. Apply the base and all nine Admin SQL migrations only to an approved isolated target.

Local checks:

```sh
npm run test:all
npm run typecheck
npm run lint
npm run build
npm run test:db:local
npm run test:roles:local
```

The Admin API is `/api/admin/content`; public discovery uses `/api/catalogue`. Public output omits private audit metadata and excludes any record with an unpublished ancestor. Every Admin route checks the server-selected role; writes also check origin, input and optimistic version. Database triggers make each programme write and its audit entry atomic.

## Remaining work

- Real browser/mobile and provider-authenticated checks.
- Authoring new learning material, verified paid entitlements, faculty assignments and complete dynamic navigation. Manual website enrolments are described in `ENROLMENTS.md`.
- Larger-catalogue pagination/search and richer audit inspection. The form currently lists all programme records.
- Remote staging migration, backup/rollback verification and owner-approved release.

Published programme listings do not grant APPX access or create questions, notes, videos or paid entitlements.
