# Website programme enrolments — development milestone

This is on draft PR #3 and has not been deployed or applied to a remote database.

## Admin workflow

1. In the Admin workspace, open **Student programme enrolments**.
2. Choose a saved website Student account. Accounts appear after saving their website profile/progress; the owner account is excluded.
3. Choose an existing Course or Test Series. Create programme records first if needed.
4. Choose Pending, Active, Paused, Revoked or Expired. New forms default to Pending.
5. Set a start and optional end in your browser's local time. A blank start means now; a blank end means no scheduled expiry. The end must be after the start.
6. Enter a reason and save. Use **Edit enrolment** for later changes. Student/programme identity stays fixed; create a different record for a different combination. Duplicate combinations are rejected; renew an existing enrolment rather than creating another.
7. Revoke instead of deleting, to retain history. Recent changes show the trusted actor, timestamp and reason; the database retains before/after snapshots.

## Student view

Signed-in users can select **My programmes** from the side menu. The endpoint derives the learner from the trusted session, never a supplied learner ID.

Active enrolments become available at their start time and expire exactly at the end timestamp. A future active enrolment shows Starts later. Paused, Revoked, Pending and Expired remain unavailable in this enrolled view. There is no expiry scheduler; the server evaluates dates on each read.

Available courses show their linked free materials and published descendant materials. A paused/archived/unpublished programme ancestor hides the enrolled collection without deleting the enrolment or its materials. Private draft titles are replaced with a generic unavailable label.

These are manual website enrolments and a personalised free-resource collection. They do not verify payments, activate APPX, grant WhatsApp/Telegram membership, or create private/premium content protection. Existing free-library URLs remain open even after an enrolment expires or is revoked.

## Validation and limits

- Admin API: `/api/admin/enrolments`; private self-read API: `/api/enrolments`.
- Explicit migration: `docs/migrations/0006_programme_enrolments.sql`, after the base and migrations 0001–0005. It remains outside the generated Drizzle journal.
- Tests cover identity isolation, input/date validation, duplicates/stale versions, hierarchy visibility, expiry, revocation, audit atomicity and retention. Local D1/Worker tests use synthetic accounts only.
- Actual provider sign-in and mobile/browser interaction remain unverified. Large rosters still require pagination/search work.
- Payment evidence, private/premium delivery and faculty workflows remain separate future work.
