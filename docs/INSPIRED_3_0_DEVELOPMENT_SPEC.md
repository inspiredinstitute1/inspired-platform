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
