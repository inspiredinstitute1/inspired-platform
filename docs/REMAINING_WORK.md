# InspirED 3.0 — remaining work, 20 October 2026

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
- Immutable approval-review snapshots bind accepted source/target reviews, evidence, links, relevant peer commitments, identities/programmes and ledger matches. Stale/restoration protection, superseding holds, atomic audit and retry-safe capture are implemented; they do not authorize posting.
- Local-only synthetic journal rehearsal with atomic entry/audit writes, duplicate prevention, captured-scope/latest-decision checks and compensating reversals. It uses separate tables, is disabled by default and does not implement real posting or independent verification.
- Independent-verification request intake tied to exact current review approvals, with frozen expected claims, dispute/cancellation history and stale/superseded binding detection. No provider adapter is configured; this does not authenticate evidence or enable real posting.
- Six audited section controls with independent navigation visibility, student route/server availability guards and retained history; Admin/account recovery stays accessible. Twelve-card note pagination, optional library cursor API and aggregate practice/repeated-error reports are implemented. See PR3_TEN_STEP_BATCH.md.
- Social/community records now have versioned, reasoned, atomic before/after audit; bounded saved-Student lookup, group/member editing, paged rosters/history and discrepancy flags are implemented. They remain manual website records, not external membership or payment proof. See PR3_TEN_STEP_BATCH_02.md.
- Local D1/R2 recovery now preserves four synthetic PDF objects, HTTP/custom metadata, PDF rows/audits and status guards; D1 recovery compares sequence counters and deleted-ID safety. Actual byte hashes are checked before PDF publication/delivery. Hosted recovery remains pending. See PR3_TEN_STEP_BATCH_03.md.
- Account-bound progress requests reject stale-tab session mismatches before database access; boot/sync validate envelopes and pause after account changes while retaining original-account device state. Same-account conflict/save races and body timeouts are covered by source tests and local Worker checks. Actual provider/browser account switching remains pending. See ACCOUNT_PROGRESS_SYNC.md and PR3_TEN_STEP_BATCH_04.md.
- Fresh frozen-lockfile registry installation and patched clean-checkout tests/build pass on Node 24.19.0/pnpm 11.25.0. A bounded local test covers 25 isolated accounts, competing writes and four simultaneous 5 MiB PDF downloads; small-overflow 413 recovery is fixed. Hosted capacity/quotas remain unmeasured. See LOCAL_OPERATIONS_VALIDATION.md.
- Admin System readiness now checks expected schema-object names and a read-only PDF-storage HEAD, fails on missing migrations/bindings/rehearsal settings, and never claims backup/gateway/capacity/release verification. Hosted metadata was inspected read-only; existing live DB currently exposes learner_progress only. Recovery and provider/community handoff procedures are prepared in OPERATIONS_AND_RECOVERY.md and PROVIDER_AND_COMMUNITY_READINESS.md.
- Progress/scoring/PWA/privacy regression coverage, build, type checking, lint and isolated local D1 migration validation.

## Feature work remaining

| Area | Remaining result |
| --- | --- |
| Faculty | Direct editing of existing shared/Admin notes and broader faculty workflows. Opt-in own-note drafting/submission and Admin review are implemented; public publishing, finance and owner controls remain Admin-only. |
| Learning material | Other file formats, larger-file/revision workflows, pagination and full-text/PDF-content indexing. Unified metadata search, bookmarks and completion are implemented. Plain-text notes and PDF uploads, review/publication, storage and programme attachment are implemented. |
| Paid/private access | Evidence-backed paid entitlements, private delivery and server-authoritative premium testing. Existing public free resources cannot be made private merely by revoking an enrolment. APPX remains separate. |
| Finance | Provider-format mapping/integrations, independent evidence verification, posting-time approval revalidation and idempotent ledger writes, previous-ledger matching and full reconciliation, fee/refund/settlement policies, verified summaries and exports. Same-batch temporary previews and durable cross-batch version-bound links with global commitment checks are implemented without posting. Normalized JSON/CSV import staging and preview are implemented; staged rows remain unverified. Manual saved learner/programme matching, evidence-reference review and durable manual evidence decisions are implemented; these do not prove provider authenticity. |
| Community | Confirmed learner/account/payment mappings, consented external identifiers, manual import/review, discrepancy reports and supported integrations. No assumed universal WhatsApp roster API or automatic removals. |
| Navigation and controls | Broader configurable navigation/division landing pages and larger-catalogue search/filtering. Six fixed learning sections now have audited enable/pause and navigation switches; programme hierarchy/status remains separately managed. Account/Admin recovery and history are intentionally always reachable. |
| Analytics | Deeper mastery/revision recommendations, item-quality and selected-batch/programme reports with valid cohort rules. Website participation, latest supported accuracy, seven-day practice activity and repeated-error aggregates are implemented without changing original attempts. |
| Scale and audit | Pagination/search for large rosters/catalogues/audit lists; broader catalogue pagination and audit/versioning for future real ledger writes. Social/community versioning and retained audits are implemented. Import/review audits and programme/resource/enrolment/faculty/material/proposal and submission-permission/PDF audits already exist. |

Release review, explicit migration inventory and proposed isolated staging scope are prepared in PR3_RELEASE_REVIEW.md. Browser and hosted acceptance rows are explicitly not run; local input audit cannot approve a release.

## Verification and release work remaining

1. Actual provider-authenticated owner/student sessions and gateway-header protection checks. Local identity simulations do not establish provider authentication.
2. Real browser/mobile interaction at narrow widths, both themes, accessibility, PWA installation and a two-device account session.
3. Remote isolated staging with hosted D1 backup/recovery, all explicit SQL migrations, integrity/row-count validation, R2 object backup/recovery and rollback verification. A disposable local D1 SQL-export/restore/checkpoint rehearsal now passes across forty-two application tables, exact schema/audits and recovered guards; combined local PDF/D1/R2 byte and metadata recovery also passes, but hosted recovery remains unverified. See LOCAL_RECOVERY_VALIDATION.md. Admin migrations remain outside the Drizzle journal.
4. Review enabled social destinations for ownership/public intent before release. Previously enabled records become public-feed eligible; private paid-group invitations must not be published unintentionally.
5. Confirm the actual hosted build toolchain, request/CPU/memory/storage quotas, cold starts, monitoring and operational recovery. Fresh-registry installation and bounded local concurrency now pass; they do not establish hosted capacity or confirm that hosting honors the tested Node pin.
6. Owner approval before merging, deployment, production migrations, DNS or live-site changes.

Suggested next implementation: a trusted provider adapter or explicitly agreed independent manual workflow that authenticates exact payment evidence and binds it to the retained expected claims. Request intake, dispute/cancellation and stale binding history are implemented; independent evidence itself remains unavailable. See FINANCE_VERIFICATION_REQUESTS.md. The local synthetic journal now rehearses posting/reversal mechanics; real posting remains blocked. See FINANCE_REHEARSAL_JOURNAL.md for the proposed acceptance requirements. Immutable review snapshots are implemented but are not posting permissions. The current selected-batch movement preview deliberately cannot approve or post payments. Direct editing of existing shared notes should require a separate revision model. Release verification can proceed as soon as an appropriate authenticated browser and isolated staging target are available.
