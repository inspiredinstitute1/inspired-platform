# Community and social-link migration checklist (development only)

Production is Sites-hosted (Vinext Worker + D1). Do **not** run these statements against production until the staging environment, identity and rollback are verified.

1. Back up the actual target D1 database using the hosting provider's supported export/backup mechanism. Record schema version and row counts. Keep exports access-restricted.
2. Apply `docs/migrations/0001_social_links.sql` and `docs/migrations/0002_community_membership.sql` to an isolated development D1 database; do not infer that GitHub commit deploys migrations.
3. Run `node --test tests/admin-community-security.test.mjs` using Node 22.13+ after `node scripts/prepare-portal.mjs`, since `progress-service.mjs` loads generated portal-catalogue.json.
4. Verify against an isolated D1: group create, enable, member upsert, reload, and social link CRUD. Confirm that disabled group/social records are not automatically shown to public users.
5. Test unauthenticated/student/owner requests with actual provider identity and confirm every admin API rejects unauthorized requests. Verify CSRF/origin checks, URL validation and no personal data in logs.
6. Review whether a member can be identified with an internal student ID, not just a submitted arbitrary string. Do not treat `paid_active` as payment verification before reconciling with APPX/PhonePe records.
7. Confirm API response pagination and loading/error states for larger membership collections. Current membership listing is limited to 500 and is not a complete-directory export.
8. A sanitized published-only `/api/social-links` feed and public footer now exist in development. Verify actual destinations, public intent and browser rendering before release; no live publication is established by local tests.
9. Confirm group membership checks and historical statuses do not automatically kick anyone out of WhatsApp/Telegram.
10. Only after staging QA and explicit owner approval: schedule controlled production migration, monitor errors, and retain rollback/export.

## Known incomplete items
- Base and all thirteen admin migrations passed isolated local D1 validation on 19 October 2026. Remote migrations and authenticated browser integration remain untested; see `PR3_DEVELOPMENT_VALIDATION.md`.
- Existing Sites identity/admin model is in use; Firebase migration is *not* part of this milestone.
- No real community, payment or social URLs have been imported.
- Social Links public display is implemented in development. Broader audit logging, verified learner/payment/community identity linkage, reconciliation and verified payment imports remain future work.
