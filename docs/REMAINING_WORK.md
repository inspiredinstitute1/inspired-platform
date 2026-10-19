# InspirED 3.0 — remaining work, 19 October 2026

All recent changes remain on draft PR #3. Working in development does not mean deployed, browser-verified or ready for release. No hours-based or formally weighted completion percentage is tracked.

## Working development foundations

- Programme hierarchy, status/order controls, atomic audit and non-destructive archiving.
- Links from programmes to existing free notes, videos and practice tests, with order/visibility and audit.
- Manual website enrolments, expiry/revocation, trusted-account selection and private My programmes view. These are not paid entitlements.
- Unified note/PDF cards, category and saved filters, metadata search, bookmarks/completion and account-scoped withdrawal history.
- Admin PDF uploads with private drafts, published-only downloads, programme links, immutable objects and audit; local R2/D1 validation.
- Separate opt-in faculty note proposals, course-scoped own drafts and Admin return/reject/accept review. Acceptance creates an unpublished Admin draft and hidden link.
- Admin-authored plain-text study notes with draft/review/publish/archive, atomic audit, public reader and programme links.
- Course-scoped faculty grants, audited enable/revoke and a private read-only teaching workspace; base roles remain Admin/Student.
- Public social footer with validated published-only feed. No actual destinations imported or ownership verified in this work.
- Community group/membership records, finance validation preview and retry-safe JSON/CSV payment-import staging. Imported rows remain unverified; none verifies real payments or external membership automatically.
- Admin manual learner/programme matching and evidence-reference review for accepted staged payments, with pending/reviewed/disputed states and atomic audit. Reviewed remains unverified.
- Saved-review ledger rules preview with temporary same-batch activation/refund links, separate tuition/mock/activation amounts, over-refund/duplicate-accounting checks and exact totals. It never verifies or posts payments.
- Durable Admin evidence decisions with exact server snapshots, fresh explicit attestations, reasons, optimistic versions and atomic before/after audits. Review changes make earlier decisions stale; provider verification and posting remain disabled.
- Saved same-batch/cross-batch activation/refund links bind both exact review versions, retain corrections/revocation and audit, enforce competing-activation/refund limits and feed a separately labelled saved-mode preview. Exact-reference lookup and global commitment limits support separate exports; context receipts are excluded from selected-batch movements. Stale links are excluded; posting remains disabled.
- Progress/scoring/PWA/privacy regression coverage, build, type checking, lint and isolated local D1 migration validation.

## Feature work remaining

| Area | Remaining result |
| --- | --- |
| Faculty | Direct editing of existing shared/Admin notes and broader faculty workflows. Opt-in own-note drafting/submission and Admin review are implemented; public publishing, finance and owner controls remain Admin-only. |
| Learning material | Other file formats, larger-file/revision workflows, pagination and full-text/PDF-content indexing. Unified metadata search, bookmarks and completion are implemented. Plain-text notes and PDF uploads, review/publication, storage and programme attachment are implemented. |
| Paid/private access | Evidence-backed paid entitlements, private delivery and server-authoritative premium testing. Existing public free resources cannot be made private merely by revoking an enrolment. APPX remains separate. |
| Finance | Provider-format mapping/integrations, independent evidence verification, durable reviewed ledger approval, previous-ledger matching and full reconciliation, fee/refund/settlement policies, verified summaries and exports. Same-batch temporary previews and durable cross-batch version-bound links with global commitment checks are implemented without posting. Normalized JSON/CSV import staging and preview are implemented; staged rows remain unverified. Manual saved learner/programme matching, evidence-reference review and durable manual evidence decisions are implemented; these do not prove provider authenticity. |
| Community | Confirmed learner/account/payment mappings, consented external identifiers, manual import/review, discrepancy reports and supported integrations. No assumed universal WhatsApp roster API or automatic removals. |
| Navigation and controls | Complete dynamic navigation, whole-feature enable/disable controls and larger-catalogue search/filtering. Programme status currently controls programme discovery only. |
| Analytics | Deeper mastery/error revision, item-quality and batch reports, with valid cohort rules and preserved original attempts. |
| Scale and audit | Pagination/search for large rosters/catalogues/audit lists; audit/versioning for social links, community and future ledger writes. Import/review audits and programme/resource/enrolment/faculty/material/proposal and submission-permission/PDF audits already exist. |

## Verification and release work remaining

1. Actual provider-authenticated owner/student sessions and gateway-header protection checks. Local identity simulations do not establish provider authentication.
2. Real browser/mobile interaction at narrow widths, both themes, accessibility, PWA installation and a two-device account session.
3. Remote isolated staging with backup, all explicit SQL migrations, integrity/row-count validation, R2 object backup/recovery and rollback verification. Admin migrations remain outside the Drizzle journal.
4. Review enabled social destinations for ownership/public intent before release. Previously enabled records become public-feed eligible; private paid-group invitations must not be published unintentionally.
5. Release Node version, fresh-registry installation, load/quota and operational recovery checks as appropriate to the final scope.
6. Owner approval before merging, deployment, production migrations, DNS or live-site changes.

Suggested next implementation: explicit approval snapshots that bind source/target reviews, manual evidence decisions, saved links and relevant peer commitments, followed by idempotent atomic ledger posting/reversal audits after evidence-authenticity requirements are settled. The current selected-batch movement preview deliberately cannot approve or post payments. Direct editing of existing shared notes should require a separate revision model. Release verification can proceed as soon as an appropriate authenticated browser and isolated staging target are available.
