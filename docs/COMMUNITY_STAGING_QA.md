# Community and social-link migration checklist (development only)

The PR #3 candidate targets Sites (Vinext Worker + D1/R2); the current public website was not changed or revalidated by this checklist. Do **not** run these statements against production until the staging environment, identity and rollback are verified.

1. Back up the actual target D1 database using the hosting provider's supported export/backup mechanism. Record schema version and row counts. Keep exports access-restricted.
2. For a fresh isolated target apply the base and all twenty explicit migrations in PR3_RELEASE_REVIEW.md order; do not infer that GitHub commit deploys migrations.
3. Run `node --test tests/admin-community-security.test.mjs` using Node 22.13+ after `node scripts/prepare-portal.mjs`, since `progress-service.mjs` loads generated portal-catalogue.json.
4. Verify against an isolated D1: group create, enable, member upsert, reload, and social link CRUD. Confirm that disabled group/social records are not automatically shown to public users.
5. Test unauthenticated/student/owner requests with actual provider identity and confirm every admin API rejects unauthorized requests. Verify CSRF/origin checks, URL validation and no personal data in logs.
6. Review whether a member can be identified with an internal student ID, not just a submitted arbitrary string. Do not treat `paid_active` as payment verification before reconciling with APPX/PhonePe records.
7. Confirm API response pagination and loading/error states for larger membership collections. Memberships now have group-filtered cursor pages and matching totals; findings cover only the loaded page. Group choices are limited to the newest 500 and are not a complete-directory export.
8. A sanitized published-only `/api/social-links` feed and public footer now exist in development. Verify actual destinations, public intent and browser rendering before release; no live publication is established by local tests.
9. Confirm group membership checks and historical statuses do not automatically kick anyone out of WhatsApp/Telegram.
10. Only after staging QA and explicit owner approval: schedule controlled production migration, monitor errors, and retain rollback/export.

## Known incomplete items
- Base and all twenty explicit Admin migrations passed isolated local D1 application/reapplication validation on 20 October 2026. Remote migrations and authenticated browser integration remain untested; see `PR3_DEVELOPMENT_VALIDATION.md`.
- Existing Sites identity/admin model is in use; Firebase migration is *not* part of this milestone.
- No real community, payment or social URLs have been imported.
- Social Links public display is implemented in development. Social/community retained audit and versioned edits are implemented; independently verified learner/payment/community linkage, reconciliation and provider-authenticated payments remain future work.

## Synthetic journal rehearsal boundary

Migration 0017 adds a separate local-only synthetic journal, not a real ledger. Keep FINANCE_REHEARSAL_MODE unset in hosted environments. Rehearsal rows must never enter verified revenue/access checks or be promoted into production. Local tests cover atomic capture/reversal and journal commitments; independent provider evidence and real posting remain pending. See FINANCE_REHEARSAL_JOURNAL.md.

## Independent-verification request intake

Migration 0018 adds Admin intake with immutable expected claims and append-only dispute/cancellation events. Queue requests do not authenticate provider evidence, post payments or establish paid membership. Provider adapters remain unconfigured. Do not infer external membership or remove users from requests/approvals. See FINANCE_VERIFICATION_REQUESTS.md.

Current all-area release proposal, migration inventory and unexecuted browser/hosted acceptance matrix: PR3_RELEASE_REVIEW.md.
