# InspirED Institute 3.0 — Development specification

Status: development only. Do not publish or change production without review.
Branch: development/inspired-3-modular-platform-2026-10-19

## Ground truth and preservation
- Production inspiredinstitute.in is a Sites-hosted Vinext Worker, using Sites-managed identity and D1, NOT currently a static GitHub Pages app.
- Preserve production API routes, scoring validation, site-scoped accounts, PWA, existing free notes/tests/videos, APPX links and student data.
- Existing backup: backup/before-learning-portal-2026-10-18; migration details in MIGRATION.md.
- Decide whether Firebase migration is warranted only after security/usage analysis. User requires zero Firebase billing and no paid service activation.
- Existing server-selected Admin via PORTAL_ADMIN_EMAIL requires runtime configuration verification, not hardcoded email.

## Brand and information architecture
Universal tagline: LEARN • EXCEL • INSPIRE
Primary divisions (fully data-driven, not fixed navigation):
1. English Language & Literature
2. Competitive Examinations
3. School Entrance (JNVST and future faculty-supported subjects)
4. University Academics (Bagalkot University first)
5. Skills & Career Development
Keep APPX primary for premium content; website specializes in public discovery, mock tests, validated assessment analytics and improvement recommendations.

## Admin no-code control (acceptance requirements)
- Admin can create, rename, order, describe and set Draft/Review/Published/Paused/Archived for divisions, courses, subjects, modules, test series and tests.
- Can create/disable faculty dashboard access scoped to assigned courses; no ability to modify Admin privileges, payments or unrelated learners.
- Publishing affects student discovery immediately after authorization; archiving NEVER cascades deletion to enrolments or historical attempt data.
- Log who made sensitive changes, old/new state, timestamp and reason.
- Course enrolment and premium mock-test entitlement can be approved, revoked, expired; APPX access not presumed or automatically granted without verified integration.
- Minors require guardian-managed profiles and age-appropriate reporting.
- Homepage/navigation are data-driven and hide unpublished records.

## Student experience
- Goal selection: Prepare for an Exam, Develop English Skills, University English, School Entrance.
- One identity with multi-programme enrolments, dynamic personalized landing page and dashboard.
- Assessment modes: official-pattern exam test, customizable skill practice, evidence-based error revision.
- Store item-level response, attempt time, marking policy, topic/skill tags, provenance, grading revision and immutable original responses.
- Question correctness and premium secrecy enforced server-side; never expose answer keys or score authority to browser. If trusted grading cannot be delivered on free infrastructure, block premium automatic release.
- Student dashboard: score, accuracy, valid cohort metrics, attempt history, topic mastery, mistake notebook and practical improvement plan.
- Admin dashboard: learner/batch progress, module usage, item-quality alerts, weakness clusters and reports.
- Speaking/writing require valid rubrics and human review initially; no invented speech accuracy.

## Nonnegotiables
- Mobile-first large readable text, black/gold plus light mode, one-row navigation and accessible interactions.
- Retain publicly accessible free resources, APPX premium pathways and existing domain.
- No SMS OTP, paid Firebase functions/storage, paid AI APIs, or adding billing without explicit consent.
- QA: auth/role isolation, unauthorized API requests, premium question leakage, scoring, migration/rollback, 320px viewport, PWA privacy, quota stress.
- Build and test on development branch. No production deployment without explicit approval.


## Admin-only Revenue & Finance dashboard
- Private owner/Admin-only route, invisible to students and faculty. Enforce authorization on the server for every finance API, export and document, not just the navigation.
- Track revenue sources separately: APPX course sales, APPX mock-test subscriptions, direct PhonePe/UPI payments, other verified gateways, offline/manual fees, workshops, and future university/skills programmes.
- Import APPX payout/sales CSV or other authorized exports first. Do not claim automatic APPX integration until credentials/API capability and reconciliation have been validated.
- Entry model: unique transaction/source reference, student identifier when appropriate, source, course, amount charged, discount/coupon, payment status, payment date, settlement date, gateway charges, refunds, taxes if applicable, net received, reconciliation state, currency INR, upload provenance.
- Distinguish gross sales, discounts, platform fees, refunds, net settlements and outstanding receivables. Never double count APPX coupon activations for students who already paid directly via PhonePe; match and link transactions before calculating net course revenue.
- Mark promotional coupon activations (e.g. low-value activation) separately from actual tuition receipts. Split regular course purchases and mock-test-only buyers.
- Financial overview: today's, 7-day, monthly, yearly collections; income by source, division, course and payment type; outstanding settlements; refunds; fee deductions; trends and downloadable filtered CSV.
- Expenses may be maintained in a separate ledger for faculty payments, software, marketing and operations. Profit views require expenses and should never label collections as profit.
- Manual adjustment and transaction deletion are restricted: use correcting entries with immutable audit history rather than silent modification; mask sensitive payer details and enforce minimum retention.
- UI must show last imported/synced timestamp, coverage window, completeness warnings, discrepancies and unreconciled payment count; never display fabricated or stale amounts as live.
- Access to external financial accounts, imports, and any paid connector requires distinct explicit approval. No banking credentials, secrets or real transaction records in GitHub.
- Finance dashboard and its module can be enabled/disabled in Admin's module manager without deleting prior ledger data.


## Social media links and community membership / payment reconciliation
- Add a public, mobile-readable, Admin-editable Social Links module with explicitly verified URLs for YouTube, WhatsApp, Telegram, Instagram, Facebook and any later channels. Do not invent links; support publish/disable/order and external-link safety.
- Create Admin-only Community Manager for WhatsApp groups, Telegram groups/channels, and website chat groups if implemented. Track group name, platform, official link, entitlement scope, intended audience and last verified date.
- Show a unified student directory linked by internal student ID, verified APPX/PhonePe/other payment records, course entitlement, expiry, and separately consented WhatsApp phone / Telegram user ID / website-chat identity.
- Statuses: Free, Paid Active, Pending Verification, Expired, Refund Review, Mock-Test-Only, Manual Exception. A paid course purchase and low-value APPX activation must not be counted as duplicate tuition; mock-test-only membership must not imply premium course WhatsApp entitlement.
- Community membership: Telegram bot may track consenting members via join requests and member-change events where authorized; Telegram Bot API has member-count and single-member checks, not a general historical full-roster export. Do not promise universal roster synchronization.
- WhatsApp: official UI exposes member lists, but do not assume any authorized general-purpose API to automatically enumerate all ordinary WhatsApp group members. Start with admin-confirmed membership and approved manual imports or join-request workflows; no unofficial scraping or WhatsApp Web automation.
- Never automatically remove a student from an external group solely because a payment status differs. Flag discrepancy for human review, confirm evidence, then use supported platform admin actions; keep appeal/override trail.
- Reports: group member count (when verified), matched/unmatched members, free vs paid by group, paid-not-in-group, group-member-without-approved-entitlement, expired access, duplicate identity, unverified phone mappings, last import/sync timestamp.
- Google Sheets/Drive may serve as export/import, backup and lightweight reconciliation, but not as an exposed browser-side authentication or permission database. Existing Sites-managed identity + D1 is the current operational source and should be evaluated before Firebase migration. Firestore Spark is optional only after review of cost, access/security and operational migration.
- Protect phone numbers, payment status, Telegram user identifiers and member lists with Admin-only server authorization, consent, data minimization and retention practices. Do not embed sensitive rosters in public GitHub files.
