# PR #3 development validation — 20 October 2026

Branch: `development/inspired-3-modular-platform-2026-10-19`.
Runtime: Node 24.19.0, pnpm 11.25.0. Also validated in a separate checkout with a fresh dependency installation from the shared package cache.
All execution was local; no production database, deployment, DNS or main-branch changes.

## Results

| Check | Result |
| --- | --- |
| `npm run test:all` | 273 test entries passed, zero failures or skips. Covers authorization, origin checks, scoped progress/scoring, PWA caching, reconciliation, database-backed admin services, bounded request-body handling and Admin form/preview state. |
| Clean dependency installation | `pnpm install --offline --frozen-lockfile --store-dir /workspace/.sites-runtime/pnpm-store --reporter append-only` restored all 640 packages in a separate checkout, with native postinstall completion and no lockfile changes. Uses cached package/policy metadata; does not verify fresh registry/network access. |
| `npm run typecheck` | Passed. Finance preview response helper now has an explicit `unknown` body type. |
| `npm run lint` | Passed with no warnings. Added the missing ESLint 9 flat configuration; generated files are ignored. The retained shell's intentional public CSS links have a file-scoped exemption. |
| `npm run build` | Passed all five Vinext/Vite build stages and emitted all thirty-three application routes. This builds artifacts without publishing them. |
| `npm run test:db:local` | Passed against Wrangler's local D1 implementation, using a fresh state directory and placeholder database ID. Applied the base migration and all nineteen admin migrations; reapplying the admin migrations preserved synthetic records. Foreign-key check returned no violations. |
| `npm run test:runtime:local` | Passed against the built Worker running locally: homepage, bundle, manifest, service worker, offline page and legacy redirect. Anonymous requests to all twenty-one admin APIs and the progress API were rejected with private/no-store responses. |
| `npm run test:roles:local` | Passed through built Worker routes and real local D1 using synthetic gateway identity headers: owner/student role rendering, all Admin API permissions, progress save/reload and cross-user isolation, stale-version conflicts, Admin exclusion from learner counts, social CRUD, community upsert, origin rejection, finance size/row limits, duplicate and invalid-amount handling. This does not verify provider sign-in. |
| `npm run test:recovery:local` | Passed: local SQL export/import preserves forty application tables and exact schema/audits; migration reapplication, checkpoint restore, integrity and recovered immutable/practice guards pass. See LOCAL_RECOVERY_VALIDATION.md. This is not hosted D1 or R2 recovery. |
| `git diff --check` | Passed. |

Additional in-memory SQLite tests exercise social-link create/read/update/delete, community group enabling and membership upsert, migration integrity, duplicate transaction references, negative amounts and invalid foreign keys. These service tests use a D1-shaped adapter; they do not establish provider-authenticated browser behavior.

## Changes

- Fixed strict TypeScript compilation in the finance preview handler.
- Restored executable modes for the shell build/install/environment entry points.
- Added repeatable database, local Worker and type-check commands.
- Added persistence and migration regression tests and ignored incremental TypeScript build metadata.
- Added the missing ESLint configuration.
- Fixed a reproducible request-stream lifecycle failure: early rejection of writes could leave the incoming stream active after response and cause local Worker 503s. The Worker now buffers API bodies within route-specific byte limits before handing them to Vinext; modest rejected bodies are drained, with a 2 MB transport cap for ordinary API requests. The PDF multipart route added below has its own bounded 6 MiB cap. Oversized transport bodies are cancelled instead of drained without bound. No write retries were added. Unit tests cover both declared and streamed limits; the local runtime regression verifies rejected writes followed by successful finance preview and checks for stream lifecycle errors.
- Applied existing form-field styling and larger mobile text to all three Admin managers; added scoped field widths, textarea styling, focus outlines, checkbox layout and wrapping for long URLs/buttons, using both theme palettes.
- Guarded social/community form saves against repeated submission while pending; original disabled states are restored on success or failure.
- Clearing a finance preview now aborts its request and ignores late responses, including when a new preview has already started. Malformed arrays and more than 200 rows are rejected before sending.
- Social link records use Enabled/Disabled; the public feed milestone below now publishes eligible enabled records.
- Added four frontend state regression tests using a small in-memory test harness. They are unit tests, not real-browser layout or accessibility validation. The generated portal bundle also passes `node --check public/portal.bundle.js`.

## Programme manager milestone

- Added hierarchical Division → Course → Subject → Module records, with Test Series and Test records under supported parents.
- Admin can create, rename, describe, reorder and set Draft, Review, Published, Paused or Archived. New UI defaults to Draft; changes require a reason.
- Database triggers enforce valid parent types, published ancestors, immutable record kinds, non-deletion and append-only audit history. Audit snapshots and writes commit atomically. Optimistic versions reject stale saves.
- `/api/catalogue` exposes only published records under fully published ancestor paths. The homepage's Explore programmes section uses this feed; no programme records are seeded or enabled automatically.
- Pausing/archiving an ancestor hides the branch without modifying descendants or learner progress. Republishing restores descendants that still have Published status.
- Added nine regression tests (seven service/database tests and two form-state tests), plus built Worker/local D1 checks for publication, hiding/restoration, audit, permissions, conflicts and Kannada descriptions.
- Local D1 validation now applies the base plus seven migrations and confirms that migration reapplication preserves both programme and audit records.
- Programme listings do not author learning resources, activate paid access or create faculty permissions (managed separately). Website enrolment records are now available through the separate enrolment manager. Global navigation and the existing free-resource catalogue remain separate. Browser interaction is still unverified.

## Programme resource-linking milestone

- Admin can assign existing free notes, videos and practice tests to programme records, set ordering and hide/show each association.
- Resource choices come from generated metadata containing only kind, ID, title and internal route. Private preview notes and unknown IDs cannot be linked; submitted titles/URLs cannot override the trusted metadata.
- Public programme discovery includes ordered resource buttons only for enabled links under fully published ancestor paths. Hiding a link or programme does not remove resources from the existing free library.
- Link identity is fixed after creation. Edits use optimistic versions; duplicate associations are rejected. Disabling retains records. Database triggers atomically append audit snapshots, and protect links/audit from physical deletion or audit tampering.
- Added six service/database regressions and built Worker/local D1 integration checks covering permissions, duplicates, stale edits, ordering, private-preview rejection, hidden branches and record preservation. Base plus six explicit migrations passed reapplication checks, including resource-link/audit rows.
- Programme linking is implemented for the existing free catalogue. Uploading or authoring new material, private/premium website delivery, verified paid entitlements and faculty authoring workflows remain pending.

## Website enrolment milestone

- Added an Admin roster limited to saved website Student accounts and existing courses/test series. Unknown IDs, owner accounts and arbitrary programme types cannot be enrolled.
- Supports Pending, Active, Paused, Revoked and Expired, scheduled starts, optional expiry, reasons and optimistic versions. Expiry is derived at read time without a cron job; revocation preserves records.
- Database triggers atomically append enrolment audit snapshots and protect enrolment/audit history from deletion or tampering. Identity changes require a separate record.
- Signed-in users have a My programmes route and a private `/api/enrolments` endpoint scoped exclusively to the session identity, ignoring requested learner IDs. No private roster, email or audit fields are returned there.
- Only active, in-date enrolments with fully published programme ancestry show linked free materials in the enrolled view, including descendant modules. Existing public free-library routes remain open.
- Added eight service/database tests and two form-state regressions. Built Worker/local D1 checks exercise approval, exact expiry, revocation, stale/duplicate rejection, Admin exclusion, anti-self-approval, cross-user isolation and audit preservation. Base plus six migrations preserve synthetic enrolment and audit rows on reapplication.
- This is a website enrolment roster and personalised free-resource view. It is not payment verification, private/premium resource enforcement, APPX activation or external community entitlement.

## Public social-links milestone

- Added `/api/social-links` and a mobile-friendly public footer driven by Admin-saved enabled records. No real destinations were seeded or published live.
- Publication requires a matching supported host for social platforms and HTTPS without credentials, nonstandard ports or local/IP destinations. Website links support other valid HTTPS domain names. Hidden drafts may retain a nonmatching platform destination, but cannot be published until corrected.
- The public feed revalidates even legacy rows and exposes only platform, label and URL in Admin-selected order. It does not fetch destinations or establish channel ownership.
- Footer links escape labels, protect new tabs and suppress referrers. The public request omits credentials; stale responses cannot restore links after a newer empty result. Unavailable/empty feeds hide the footer section.
- Six new tests cover destination rules, legacy/hidden exclusion, projection/order, publish validation, HTML/navigation safety and stale responses. Built Worker/local D1 checks cover publication, exclusion and immediate removal.
- Review all previously enabled records for public intent before release, especially community invitation URLs. Social-link audit/versioning and actual browser interaction remain pending.

## Course-scoped faculty milestone

- Admin can assign saved non-Admin accounts to courses, enable or disable access, and review append-only assignment history. New assignments default to disabled; changes require a reason and version check.
- Admin and Student remain the only base roles. Teaching access is a separate server-checked capability, with no Admin, finance, permission-management or unrelated-course access.
- The private read-only teaching workspace shows assigned courses and descendants, including drafts for review, linked free materials and active course enrolment counts. It returns no student roster, contact information or payment records.
- Every read scopes by trusted session identity. Grants are checked again before returning results so a mid-read revocation suppresses course data. Navigation may need a page refresh; API authorization is checked on every request.
- Seven service/database tests and two form-state regressions cover scope, revocation, conflicts, audit integrity and role isolation. Built Worker/local D1 checks verify enable/revoke, session-scoped reads and rejection from all Admin APIs. The base plus seven explicit migrations preserve synthetic records when reapplied.
- Course record editing, uploads, publishing and learner management are not delegated. Separate opt-in faculty note proposals are described below. Actual provider sign-in and browser/mobile interaction remain unverified.

## Authored study-note milestone

- Added an Admin editor for new English/Kannada plain-text notes, with title/category, up to 20,000 characters, change reasons and Draft, Review, Published and Archived states. Creation is draft-only; publication is a subsequent explicit edit. The route accepts up to 100 KB of UTF-8 JSON, supporting longer Kannada text.
- Atomic audit triggers retain full before/after text and trusted actor identity. Optimistic versions reject stale edits; archive retains the note, existing programme links and append-only history. Admin history listings omit snapshot bodies while the database retains them.
- `/api/materials` exposes only published metadata; detail reads expose only published note text. Draft/review/archived notes return 404 even for guessed IDs or requested status filters. The public reader escapes all text and ignores responses for detached readers after navigation. All reads use no-store; the service worker does not cache APIs.
- The Free notes page now has a separate More free study notes section. Programme links can select authored drafts, but public discovery and enrolment/faculty resource views resolve them only while published. Existing free catalogue entries and private Admin previews are retained separately.
- Five service/database tests and three frontend regressions cover privacy, publication/archive, origin and role checks, bounded input, conflicts, atomic audit rollback, safe rendering and late responses. Built Worker/local D1 checks verify long Kannada text and the full lifecycle through programme/enrolment/faculty projections. Base plus eight explicit migrations pass fresh application, reapplication and synthetic-record preservation checks.
- Published notes are free to everyone independently of enrolments or teaching grants. Previously read text cannot be recalled. PDF uploads are implemented in the milestone below. Rich-text editing, full-library search integration, bookmarks/completion for new notes and direct faculty editing of existing Admin notes are still pending. Actual provider sign-in and browser/mobile interaction remain unverified.

## Faculty note review milestone

- Added a separate per-assignment submission permission, disabled by default. Existing teaching assignments remain read-only until Admin explicitly enables note submissions. Both the teaching grant and submission permission must currently be enabled.
- Faculty can create plain-text course-note drafts, revise their own drafts and submit for Admin review. Session identity and SQL predicates scope every read/write; requested author/course IDs cannot authorize unrelated records. Submitted text is locked until Admin returns it.
- Admin can return a submission with author-visible feedback, reject it while preserving history, or accept it into a separate Admin study-note draft and a hidden course link. Acceptance is not publication. Publishing the draft and enabling its programme link remain separate Admin actions.
- Proposal and permission changes use optimistic versions and append-only atomic audit. Acceptance and all dependent material/link/audit writes commit together; injected failures in each downstream audit roll back the entire acceptance. Accepted/rejected proposal snapshots are terminal and cannot be edited.
- Eight service/database tests and three frontend regressions cover opt-in defaults, own-draft/course scope, long text limits, safe rendering, review/return/resubmission, stale writes, revocation at mutation time and atomic rollback. Built Worker/local D1 checks verify the lifecycle, hidden accepted material, cross-user isolation and both permission revocations. Base plus nine explicit migrations pass application, reapplication and synthetic row/foreign-key validation.
- Revoked faculty lose proposal reads and writes; Admin retains submitted work for review and history. Re-enabling both permissions restores access to retained own proposals. No direct faculty editing of existing Admin/published notes, file uploads, public publishing, finance or enrolment management is delegated. Real provider sign-in and browser/mobile interaction remain unverified.

## PDF upload and delivery milestone

- Declared the existing optional R2 binding as BUCKET in the source manifest and validated it with local Wrangler emulation only. No hosted storage was provisioned, deployed or modified.
- Added Admin multipart uploads up to 5 MiB, with a dedicated 6 MiB request cap. Other routes retain their existing limits. Filename/MIME, size, PDF header and ending checks precede storage; SHA-256 and byte count are recorded. These checks do not parse the whole PDF or scan for malware.
- New uploads are private Drafts regardless of submitted status or object-key fields. Server-generated immutable storage keys prevent replacement in place. Metadata changes use current versions, reasons and atomic append-only audit; archive retains the object and programme associations.
- Controlled downloads never expose bucket keys or direct object URLs. Admin can download drafts for review; public reads/downloads resolve only published metadata. Downloads use application/pdf, attachment filenames generated from trusted IDs, nosniff, sandbox CSP and private/no-store. Publication is rechecked after storage fetch to suppress an archive during that read.
- Published PDFs appear in a separate Free PDF study notes section and resolve as trusted Note choices in programme links and active enrolment/faculty resource views. Archive hides future public downloads and projections; already downloaded copies cannot be recalled. Existing catalogue PDFs remain unchanged.
- Eight service/database tests, three frontend tests and one transport regression cover privacy, size/format checks, multipart fields while controls are disabled, safe labels, version conflicts, retained history, object mismatch and failed-save cleanup. A metadata/audit failure attempts to remove only its new private object; a cleanup failure can leave an unreferenced private object, with no published database pointer.
- The production build passes with 22 routes. Local R2/D1 Worker checks verify a 2.1 MB upload, oversized-file rejection followed by recovery, byte-for-byte download, draft privacy, publication/archive, programme/enrolment links and retained audit. The initial generic owner-read smoke assumption was corrected: the download endpoint requires an ID and correctly returns 404 without one. Base plus ten explicit migrations preserve synthetic rows and foreign keys on reapplication.
- Real provider sign-in, browser/mobile downloads, hosted R2 provisioning, object backup/recovery and remote staging remain unverified. This is free PDF delivery, not paid/private learner entitlement or faculty file-upload delegation.

## Unified learning library milestone

- Added public `/api/library` metadata and direct-detail reads for published authored notes and PDFs. One SQL UNION scopes both sources to Published; response fields omit private body snapshots, actor/reasons, versions, original filenames and storage keys. Text excerpts are limited to 160 characters. Draft/review/archive detail requests return 404 regardless of requested role/status.
- Original notes, authored notes, uploaded PDFs and the account's own private Admin previews now share note cards, category filters, saved-only filtering, available counts, reading paths and global search. New category names are discovered automatically, escaped and mapped to a fixed safe CSS class. Search matches titles/categories/descriptions and existing catalogue search terms; it does not extract/index PDF contents or full authored-note text.
- Added PDF reader routes with fresh published metadata, controlled downloads, bookmarks and explicit Mark as complete. Downloading alone does not complete a PDF. Authored text readers also have save/completion controls. Programme PDF links now open the reader; existing direct download URLs still work while published.
- Existing account progress now validates newly saved/completed authored/PDF IDs against Published metadata. Previously recorded IDs remain valid only from the trusted account's own history after withdrawal, without authorizing content access. New draft/nonexistent IDs are uniformly omitted with an unavailableResources acknowledgement so valid practice progress is not blocked; arbitrary legacy/unknown IDs still fail validation. No new migration or progress schema was needed.
- Withdrawn saved IDs have removable unavailable placeholders; completion history is retained separately from available-note counts. A failed metadata load drops stale dynamic labels and offers retry while retaining the original catalogue. Late responses cannot replace newer results or redraw an editor/test after navigation; search focus/selection is restored. Window-focus sync no longer redraws forms in the main workspace.
- Seven service/database tests and eight frontend tests cover publication/privacy, account persistence, omission/withdrawal handling, stale conflicts, filters/search, escaping, asynchronous focus/navigation and PDF completion. One obsolete separate-PDF-list UI test was replaced by unified-library coverage. All 125 test entries pass.
- Production build (23 routes), type checking, lint, bundle syntax, base plus ten explicit local D1 migrations and built Worker/local R2/D1 checks pass. The runtime flow verifies new-note/PDF saves, reload, stale conflicts, archive retention/removal, unknown-ID omission and cross-account isolation. No hosted state or actual learner records were used.
- Workspace maintenance removed the prior unfinished checkout; it was reconstructed from the saved draft branch and session history, then fully checked again. A managed preview was started for browser QA but the cloud browser received ERR_CONNECTION_REFUSED. Correcting the ignored local execution profile did not establish a reachable preview, so it was stopped. Browser/mobile layout, authenticated sessions and two-device behavior remain unverified. API and frontend unit checks are not substitutes for those release checks.

## Unverified payment-import review milestone

- Added Admin-only normalized JSON/CSV imports into immutable staging batches/rows, separate from finance_transactions. Each row is accepted for unverified review, duplicate or rejected. No import verifies a payment, populates a revenue ledger, creates a learner or changes enrolment/community access.
- Canonical CSV headers are provided by a downloadable header-only template. Provider exports must be mapped first; no APPX/PhonePe-specific export layout or API integration is assumed. Quoted commas/quotes, BOM and CRLF are parsed. Import dates require a real YYYY-MM-DD calendar date; amounts require integer paise with gross minus fee equal to net. Invalid course-code lengths are rejected rather than silently discarded.
- Duplicate checks cover the batch, previously accepted staging references and existing transaction-table references. Conflicting details are flagged without overwriting a source record. Student/course identifiers remain claims requiring review; activation rows carry an explicit matching-pending flag. This milestone shows counts and individual amounts, not verified revenue totals.
- Retry-safe request IDs and server fingerprints return an existing batch on an identical retry and reject changed input under the same key. Reference uniqueness protects competing imports. Batch, canonical rows and append-only audit commit in one two-statement D1 batch; injected audit/row failures and concurrent-reference conflicts roll back the whole losing import.
- Raw snapshots retain bounded canonical fields only; unknown JSON fields are not saved. Source/export labels are provenance notes, not uploaded provider evidence or proof of payment. Immutable records retain duplicate/rejected issues. Per-batch count guards prevent additions beyond recorded row/verdict counts.
- Ten service/parser/database tests and three frontend regressions cover auth/origin, parsing and strict fields, duplicate/conflict handling, retries, atomic rollback/races, bounded snapshots, immutable history and safe rendering. All 125 test entries pass. Built Worker/local D1 checks also exercise a 200-row atomic import, CSV rejection, identity boundaries, replay, readback and retained audit.
- Production build (24 routes), TypeScript, lint and bundle syntax pass. Base plus eleven explicit local D1 migrations pass fresh application/reapplication, synthetic-row preservation and foreign-key validation. No real payment records, provider accounts or remote migrations were used. At this import milestone evidence review, learner matching and reviewed ledger approval were pending; the later review milestone below adds matching/evidence-reference tracking; browser/mobile verification remains pending.

## Reproduce

Use Node 22.13 or newer with the locked dependencies installed. Then run:

```sh
npm run test:all
npm run typecheck
npm run lint
npm run build
npm run test:db:local
npm run test:runtime:local
npm run test:roles:local
```

The local validation scripts reject a non-placeholder database ID and explicitly pass `--local`. They retain only disposable synthetic/empty state beneath ignored `.wrangler/` directories. The Worker smoke test shuts down its own server. The role check supplies only synthetic identity headers to the local Worker; hosting is responsible for authenticating and sanitizing these headers in production.

## Learner matching and evidence review milestone

- Added Admin-only accepted-row reviews with explicit saved Student/programme matches, plain-text evidence reference/notes, pending/reviewed/disputed states and required change reasons. Imported identifiers remain untrusted claims; no automatic mapping. Reviewed requires both matches and an evidence reference but never means verified payment.
- Added migration 0012 with restricted foreign keys, accepted-row/programme guards, immutable row identity, no deletion and atomic append-only before/after audit triggers. Creates/updates use optimistic versions; stale or competing writes preserve the winner and return 409. Audit failure rolls back the review change.
- Added escaped Admin forms, manual dropdown selection, explicit row reload, preserved unsaved input on failure and late-response guards for batch selection.
- Seven service/database tests and three frontend tests pass; current total is 135. Built Worker/local D1 verifies role/origin boundaries, invalid matches/evidence, duplicate/rejected exclusion, creation/reopening, stale conflict, retained audit and unchanged Student enrolments. SQLite service checks also confirm zero ledger writes.
- Build emits 25 routes, including fourteen Admin APIs; TypeScript, lint and bundle syntax pass. Base plus twelve explicit migrations pass local application/reapplication, synthetic-row preservation and foreign-key checks. No real payment records, ledger posting, payment verification, access grants or remote migrations were performed. Browser/mobile/provider sign-in and isolated remote staging remain pending. See FINANCE_REVIEW.md.

## Saved-payment ledger rules preview milestone

- Added a separate Admin-only, no-write preview based on saved accepted rows and their reviewed learner/programme matches. Caller-provided totals, transactions and verification claims are ignored. Complete exact review-version snapshots are required; stale/duplicate/missing versions return 409.
- Added explicit temporary same-batch activation/refund links. APPX activation requires same-learner/programme non-APPX tuition and remains separate from tuition gross. Refunds require original tuition/mock payment, consistent matches/dates and zero fees. Excess cumulative refunds and competing activations are blocked as groups; blocked targets exclude their dependants. Existing transaction references cannot be counted again. Unresolved adjustments/fee directions remain blocked.
- Exact BigInt totals detect unsafe-number overflow. Blocked proposals are excluded with explicit incomplete-total labels. Mock-only payments grant no group access. The endpoint always reports unverified and canPost=false; no approval token, persistent link, ledger entry, verification decision or entitlement is created.
- Nine policy tests, six service/database tests and three frontend tests pass, bringing the current total to 153. SQLite total_changes confirms no preview writes. Build (26 routes/fifteen Admin APIs), TypeScript, lint and bundle syntax pass. Base plus twelve explicit local D1 migrations pass application/reapplication and foreign-key checks; no new migration was needed.
- Built local Worker/D1 checks verify saved review versions, separated tuition/activation amounts, stale rejection, grouped over-refund blocking, role/origin limits and unchanged Student enrolments. All records are synthetic. Browser/provider sign-in, remote staging and real payment evidence remain unverified. See FINANCE_LEDGER_PREVIEW.md.

## Durable Admin evidence-decision milestone

- Added Admin-only pending/confirmed/disputed decisions with explicit checked methods, notes, change reasons and fresh human attestations. Confirmation requires current reviewed Student/programme matches. Methods do not connect to providers; records remain manual attestations, not automated verification, ledger approval or access grants.
- Migration 0013 captures immutable-import/current-review snapshots and binds each decision to the exact review version. Any saved review change makes older decisions stale without rewriting history. Current confirmations also become unavailable if a match no longer qualifies. Database guards prevent forged snapshots/identity changes; own decision versions protect competing updates.
- Conditional SQL writes prevent review changes between preflight and persistence from creating stale confirmations. Full before/after audit inserts are atomic; injected audit failures roll back inserts/updates. Decisions/history cannot be deleted. The frontend preserves unsaved fields on conflict, resets attestation to unchecked on reload and ignores late batch responses.
- Ledger previews now report effective evidence states/decision versions and missing-current-confirmation blockers. All-current manual attestations still cannot enable posting. Proposed accounting totals remain explicitly separate from evidence authenticity. Saved evidence changes invalidate earlier preview output.
- Ten service/database tests and four frontend tests pass; current total is 167. Build emits 27 routes including sixteen Admin APIs; TypeScript, lint and bundle syntax pass. Base plus thirteen explicit migrations pass local application/reapplication, synthetic-record preservation and foreign-key checks.
- Built Worker/local D1 verifies manual confirmation, captured amounts/server actor, stale detection, reconfirmation, disputes, optimistic conflicts, audit retention and disabled posting/unchanged Student enrolments. Only synthetic records were used. Provider sign-in, browser/mobile, remote staging and real evidence checks remain unverified. See FINANCE_EVIDENCE_DECISIONS.md.

## Saved activation/refund link milestone

- Added explicit Admin same-batch reviewed activation/refund relationships with current source/target review versions and server-captured pair snapshots. Imported claims and temporary preview dropdowns never create stored links. Active matching enforces Student/programme, kind/source/date and zero-fee refund rules; cross-batch and existing-ledger targets remain unsupported.
- Migration 0014 adds link versions, immutable source identity, audited target corrections, revoke/reactivate and atomic append-only before/after history. Review edits make active links stale. Conditional writes prevent preflight/persistence review races. Database triggers enforce one current activation per tuition and cumulative current refund limits under competing writes. Failed audit/conflict writes preserve prior link/history.
- Added saved-mode ledger preview with complete pinned link versions and explicit state/version labels. Stale/revoked/unavailable links are excluded; temporary previews remain no-write. Neither mode can verify/post payments or grant access. Preview generations prevent pending responses from restoring old totals after saved finance changes; reload buttons retrieve current link versions.
- Twelve service/database tests, four saved-link frontend tests and two additional preview regressions pass; current total is 185. TypeScript, lint, bundle syntax and build pass (28 routes/seventeen Admin APIs). Base plus fourteen explicit local migrations pass application/reapplication, synthetic-row retention and foreign-key checks.
- Built Worker/local D1 verifies pair snapshots/actors, stale/revoke/reactivate lifecycle, saved-preview version conflicts, refund-cap rejection and unchanged Student enrolments. Only synthetic records were used. Browser/provider sign-in, remote staging and real payment/evidence verification remain pending. See FINANCE_PAYMENT_LINKS.md.

## Cross-batch payment matching milestone

- Migration 0015 replaces relationship guards to allow reviewed staged targets in different batches, preserving existing pair snapshots, history and global activation/refund limit triggers. Exact Admin source/reference lookup validates saved identities, kinds/dates and reviewed status; it writes nothing and cannot advance a changed source review silently. Existing-ledger targets remain blocked.
- External targets display current batch/payment/match details and remain version-bound on save/reload/revoke. Any target review edit makes links stale across batches. Selected/link versions and current context are checked during preview; an external target racing context reads receives 409.
- Preview amounts now explicitly describe selected-batch movements. Earlier original receipts are context only and never counted again. Later refunds can produce negative category/cash movements. Global peer reservations constrain both modes and are shown separately; external evidence/ledger conflicts participate in validation. No approval token, verified revenue, posting or access is created.
- Nine service/database tests, three frontend tests and two additional policy tests pass; current total is 199. TypeScript, lint, bundle syntax and build pass (unchanged 28 routes/seventeen Admin APIs). Base plus fifteen explicit local migrations pass application/reapplication, cross-batch synthetic-link preservation and foreign-key checks.
- Built Worker/local D1 verifies exact lookup, global activation/refund conflicts, excluded earlier receipts, negative batch movement and stale external reviews, with unchanged Student enrolments. All records remain synthetic. Real evidence/provider sign-in, browser/mobile and remote staging remain unverified. See FINANCE_CROSS_BATCH.md.

## Local recovery verification milestone

- Added a no-arguments local-only recovery command using a checked placeholder binding and fresh synthetic state. Wrangler export/import runs only against disposable targets. Exact row/schema comparisons cover forty application tables, audit values and all application triggers/indexes/views.
- Restore/reapply preserves the pre-backup custom module setting and immutable finance/verification histories. A third empty target recovers the retained checkpoint after a post-backup source change. Recovered append-only guards and paused-practice write rejection pass. D1 foreign-key checks are clean; read-only local SQLite integrity checks return ok because D1 itself rejects integrity_check.
- Recovery integration, lint and type checking pass; application baseline remains 273 tests and the previously validated 33-route build/local Worker. No application code or migration changes in this milestone.
- Real browser/provider/mobile/two-device and remote staging checks remain unverified. No connected local browser is exposed in the current session, and there is no repair evidence for the earlier cloud preview failure. No hosted deployment was made. LOCAL_RECOVERY_VALIDATION.md distinguishes the completed rehearsal from hosted D1/time-travel, production rollback and R2 recovery still pending.

## Ten-step section-control, browsing and report batch

- Delivered the ten bounded steps in PR3_TEN_STEP_BATCH.md: six-section policy, migration/audit, Admin API/editor, public availability, startup/refresh guards, dynamic navigation, server delivery/practice guards, library paging and aggregate learning reports, followed by regression/local validation.
- Section availability and navigation visibility are independent. Account/Admin recovery and saved history remain reachable. Pausing preserves records, does not make free resources private and does not affect external services. Legacy missing-table fallback preserves prior behavior; genuine query failures do not enable sections.
- Migration 0019 provides fixed keys, monotonic versions, atomic audit and database-level paused-practice insert/update guards. Published library/material/PDF/programme and Student teaching/enrolment endpoints consult current settings; private Admin management remains available. PDF streams recheck the module after object retrieval.
- Twelve-card library pagination preserves filtering/history; optional keyset API pages have validated 1–100 sizes/cursors. Full-index compatibility remains for saved-note availability/search; full-text/PDF indexing and larger-catalogue loading remain open.
- Private aggregate reports recompute latest supported answer accuracy, seven-day practice activity and repeated-error pairs, exclude Admin practice and do not infer syllabus coverage. Original attempts are unchanged.
- Eighteen added regressions pass (273 total). Types, lint, syntax and build pass (33 routes/twenty-one Admin APIs). Base plus nineteen explicit local migrations preserve data/audit and foreign keys on reapplication. Built Worker/local D1 validates switch/re-enable behavior, disabled practice writes, retained history, paging and aggregate reports. Browser/mobile/provider and remote staging QA remain unverified.

## Independent-verification request intake milestone

- Added an Admin queue under approval snapshots. A current complete latest review approval can create one retained request with server-derived expected INR payment claims, exact source/reference/amount/date/kind/mapping/target facts and selected-vs-context rows. Requests do not contact providers or authenticate evidence; adapter readiness is explicitly false.
- Migration 0018 binds tasks to exact approval scope/latest decision with atomic SQL/DB guards and an initial append-only event. Admin actions only dispute/cancel; database states cannot represent verified evidence. Event versions prevent lost updates; stable retry IDs recover committed tasks/events even during concurrent identical submissions. History and expected claims cannot be edited/deleted.
- Supporting changes or new holds make request bindings stale/superseded, including change-then-restore. Retained details remain available as unavailable when current scope cannot validate; stale tasks can still be disputed/cancelled. Existing reviews, links, manual evidence, actual transactions and access remain unchanged.
- Fifteen service/database and five UI tests pass (255 total); build (31 routes/twenty Admin APIs), TypeScript, lint and bundle syntax pass. Base plus eighteen explicit local migrations preserve synthetic verification tasks/events and clean foreign keys on reapplication.
- Built Worker/local D1 verifies exact expected claims, trusted actors, retry/duplicate protections, hold supersession, disputes, cancellation and unchanged Student enrolments. Real provider authentication/evidence, browser/mobile and remote staging remain unverified. FINANCE_VERIFICATION_REQUESTS.md documents the workflow and remaining integration requirements.

## Synthetic local journal rehearsal milestone

- Added a disabled-by-default, Admin-only loopback endpoint for explicitly named synthetic fixtures. An explicit process flag enables it only in disposable local tests; no hosting configuration or product UI enables it.
- Migration 0017 creates separate immutable rehearsal operations, signed movements and atomic audits. Exact captured scope and latest review decision are revalidated inside the post; database guards repeat the checks. Caller entries/actors cannot override server facts. Real finance_transactions, verification and access records are untouched.
- Retry-safe commands prevent duplicate original rows and repeated reversals. Reversals append exact compensation and preserve original records. External dependants require a matching active rehearsal original; originals cannot reverse before active dependants. Already posted refund/activation commitments continue to constrain the journal after saved links are revoked.
- Seventeen additional tests pass (235 total), including concurrent decision/identity races, concurrent identical retry, audit/entry rollback, stale/restored supporting facts, separate mock/activation movements and cross-batch compensation. Build, TypeScript, lint and bundle syntax pass (30 routes/nineteen Admin APIs). Base plus seventeen local migrations preserve synthetic posts/reversals/audits and clean foreign keys on reapplication.
- Built Worker/local D1 verifies synthetic journal capture, trusted actor, separate activation receipts, retry recovery, duplicate prevention and exact reversal with unchanged Student access. Actual provider evidence remains unavailable. FINANCE_REHEARSAL_JOURNAL.md defines proposed independent-verification requirements; real posting remains unimplemented.

## Immutable approval-review snapshot milestone

- Added Admin review-approved/held captures from one canonical scope: selected accepted transactions/reviews, external originals, exact manual evidence and saved links, relevant peer relationships/supporting records, identities/programmes and existing ledger matches. Candidate views disclose excluded duplicate/rejected rows and selected-batch movement scope. No captured decision verifies provider payments, grants access or enables posting.
- Review approval requires complete saved payment rules, exact current links, safe totals and current manual evidence confirmations, plus explicit fresh attestation/reason. Holds retain unresolved review. Server facts/actor override caller claims; scope SHA identifies exact state, not provider authenticity. Writes bind/recheck scope inside SQL with a matching database guard; stale state or peer membership races return 409.
- Migration 0016 retains immutable snapshots/audits atomically and adds monotonic identity/ledger counters so restoring prior values cannot revive old approvals. Current records become stale after supporting changes; unrelated imports do not invalidate them. A later decision for the same scope supersedes earlier decisions by audit sequence, so a hold can replace a review approval without erasing it.
- Capture retries recover the original record without duplicate audits; changed input under the same ID conflicts. Bounded scope/overflow sentinels reject more than 600 scoped records, 400 peers or 250,000 UTF-8 bytes. Retained snapshot details remain readable as unavailable when current scope cannot be validated. Frontend preserves unsaved input, guards pending saves/late responses and invalidates local candidates after supporting writes.
- Fifteen service/database tests and four frontend tests pass; current total is 218. TypeScript, lint, bundle syntax and build pass (29 routes/eighteen Admin APIs). Base plus sixteen explicit local migrations pass application/reapplication, synthetic snapshot/audit preservation and foreign-key checks.
- Built Worker/local D1 verifies hold/approval eligibility, trusted captured facts, retry recovery, peer-driven staleness and retained immutable history, with disabled posting and unchanged Student enrolments. All records remain synthetic. Real provider/evidence checks, browser/mobile and remote staging remain unverified. See FINANCE_APPROVAL_SNAPSHOTS.md.

## Remaining release checks

- Provider-authenticated Admin/Student browser sessions and mobile UI interaction remain unverified in this pass. Anonymous local HTTP checks and service-level identity simulations passed.
- Clean cached dependency installation passed; an exact Node 22 run and fresh registry installation were not performed. Tests used Node 24.19.0.
- Remote staging/production migrations were not run. The nineteen admin migrations remain explicit SQL files under `docs/migrations/`, outside the generated Drizzle migration journal.
- Existing incomplete features remain: audit logging outside programme/resource/enrolment/faculty/material/proposal/PDF and import/review managers, verified learner/payment/community linkage, verified payment import/reconciliation and full-directory pagination. The public social feed is implemented in development; saved enabled destinations require review before release. Synthetic membership/payment statuses do not verify real payments or grant external group access.
- Keep this PR a draft. Production migration and release require owner approval and the separate staging/backup checks.
