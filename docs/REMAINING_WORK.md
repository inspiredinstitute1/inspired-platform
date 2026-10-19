# InspirED 3.0 — remaining work, 19 October 2026

All recent changes remain on draft PR #3. Working in development does not mean deployed, browser-verified or ready for release. No hours-based or formally weighted completion percentage is tracked.

## Working development foundations

- Programme hierarchy, status/order controls, atomic audit and non-destructive archiving.
- Links from programmes to existing free notes, videos and practice tests, with order/visibility and audit.
- Manual website enrolments, expiry/revocation, trusted-account selection and private My programmes view. These are not paid entitlements.
- Course-scoped faculty grants, audited enable/revoke and a private read-only teaching workspace; base roles remain Admin/Student.
- Public social footer with validated published-only feed. No actual destinations imported or ownership verified in this work.
- Community group/membership records and finance validation preview; neither verifies real payments or external membership automatically.
- Progress/scoring/PWA/privacy regression coverage, build, type checking, lint and isolated local D1 migration validation.

## Feature work remaining

| Area | Remaining result |
| --- | --- |
| Faculty | Authoring/edit delegation and review workflows. Audited owner-controlled grants and a read-only assigned-course dashboard are implemented; finance and owner controls remain Admin-only. |
| Learning material | Author/upload new notes and other material, review/publish workflows, storage and programme attachment. Existing links only select from the current free catalogue. |
| Paid/private access | Evidence-backed paid entitlements, private delivery and server-authoritative premium testing. Existing public free resources cannot be made private merely by revoking an enrolment. APPX remains separate. |
| Finance | Authorized imports, persisted verified ledger, tuition/activation matching without double counting, fees/refunds/settlements, summaries and exports. Current tool is a preview only. |
| Community | Confirmed learner/account/payment mappings, consented external identifiers, manual import/review, discrepancy reports and supported integrations. No assumed universal WhatsApp roster API or automatic removals. |
| Navigation and controls | Complete dynamic navigation, whole-feature enable/disable controls and larger-catalogue search/filtering. Programme status currently controls programme discovery only. |
| Analytics | Deeper mastery/error revision, item-quality and batch reports, with valid cohort rules and preserved original attempts. |
| Scale and audit | Pagination/search for large rosters/catalogues/audit lists; audit/versioning for social links, community and future finance writes. Programme/resource/enrolment/faculty audits already exist. |

## Verification and release work remaining

1. Actual provider-authenticated owner/student sessions and gateway-header protection checks. Local identity simulations do not establish provider authentication.
2. Real browser/mobile interaction at narrow widths, both themes, accessibility, PWA installation and a two-device account session.
3. Remote isolated staging with backup, all explicit SQL migrations, integrity/row-count validation and rollback verification. Admin migrations remain outside the Drizzle journal.
4. Review enabled social destinations for ownership/public intent before release. Previously enabled records become public-feed eligible; private paid-group invitations must not be published unintentionally.
5. Release Node version, fresh-registry installation, load/quota and operational recovery checks as appropriate to the final scope.
6. Owner approval before merging, deployment, production migrations, DNS or live-site changes.

Suggested next implementation: material authoring with explicit faculty edit scope and review rules, then verified finance import. Release verification can proceed as soon as an appropriate authenticated browser and isolated staging target are available.
