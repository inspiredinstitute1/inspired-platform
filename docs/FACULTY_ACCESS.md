# Course-scoped faculty access

Development-only implementation on draft PR #3. Apply `docs/migrations/0007_faculty_assignments.sql` after the preceding explicit migrations in an approved isolated environment. No live migration or actual-person assignment was performed.

## Admin workflow

Open the programme manager and select an existing saved Student account and a Course in Faculty assignments. New assignments default to disabled. Enter a reason of 3–300 characters, save, then enable when appropriate. Each save uses an optimistic version and atomically records the server actor and before/after state. Duplicate pairs and stale saves are rejected. Course/account identity cannot be edited; disable the existing assignment and create a different one. Records and audit history cannot be physically deleted.

## Teaching workspace

Admin and Student remain the only base roles. An enabled course grant adds Teaching workspace to the account menu after refresh. The private `/api/faculty` endpoint uses the authenticated session identity, ignoring requested user/course IDs. It includes only assigned courses, their descendants (including drafts for review), known free resource links and active course enrolment counts. It contains no learner roster, contact information, payment data or owner audit history.

The workspace is read-only. It grants no content editing, publishing, uploads, enrolment changes, community administration, finance access or permission management. Existing public free materials remain public independently of teaching assignments.

Disabling a grant removes course data on the next API read. A final grant check also suppresses results revoked during a read. A menu already on screen may persist until refresh; it does not authorize API access. Responses are private and no-store.

## Validation and limits

Seven service/database regressions, two form-state regressions and built Worker/local D1 checks cover identity scope, unrelated courses, enable/revoke, immutable identities, conflicts, atomic append-only audit and Admin API rejection. Base plus seven explicit migrations pass reapplication and foreign-key checks. Missing assignment schema fails closed for the menu capability.

Provider-authenticated sessions, real browser/mobile interaction and remote staging remain unverified. Faculty authoring/editing needs a separate permission and review design before implementation. This feature does not establish paid entitlements or APPX access.
