# Ten-step development batch — 20 October 2026

User authorization: proceed through the next ten development steps without waiting for another prompt. Existing limits remain: no merge, deployment, remote/production migrations, DNS changes or live-site edits.

| Step | Delivered result | Evidence |
| --- | --- | --- |
| 1 | Fixed catalogue of six controllable sections: library, practice, videos, programmes, teaching and APPX information. Account/Admin access and saved result/history routes remain outside the switches. | module-policy.mjs; module controls tests |
| 2 | Migration 0019 adds retained module settings, monotonic versions and atomic append-only audit history. All six start enabled to preserve existing behavior. Reapplication preserves custom settings. | local D1 and SQLite migration tests |
| 3 | Admin module API validates identity, origin, bounded JSON, section keys, versions and reasons; public availability omits private audit details. Genuine database errors fail closed. | module-service.mjs; authorization/conflict/rollback tests |
| 4 | Admin editor offers independent enabled/paused and navigation-visible/hidden choices, pending-save protection and retained unsaved fields on conflict. | module-admin.js; Admin form tests |
| 5 | Initial availability loads before portal rendering; malformed/unavailable client configuration does not enable controllable sections. Focus/online refreshes ignore old responses and preserve forms. | cloud-boot.js; module-navigation.js; async-state tests |
| 6 | Sidebar, mobile navigation, homepage pathways, route entry and learning actions respect current settings. Mobile slots resize to the remaining visible links. Saved results, progress, account and Admin recovery remain reachable. | navigation tests; bundle/build syntax |
| 7 | Server checks pause published note/PDF/library/programme/Student-enrolment/faculty/proposal endpoints; private Admin managers remain accessible. Practice writes are guarded atomically in D1, retaining existing attempts/drafts while allowing unrelated saves. | local Worker route tests; practice insert/update guards |
| 8 | Note cards page twelve at a time with accessible Previous/Next controls and filter resets. An optional 1–100 item keyset API pages the published library deterministically by update time and ID. | library/UI pagination tests; local Worker paging |
| 9 | Private Admin reports add supported-attempt participation, rolling seven-day practice activity and repeated learner/question error pairs. Accuracy is recomputed from latest supported answers; Admin practice is excluded by current trusted email role. No syllabus-completion percentage is inferred. | learning-report tests; Admin local Worker response |
| 10 | Full regression, types, lint, bundle syntax, build and all nineteen explicit local migrations validated. Built Worker tests verify paused/re-enabled routes, history retention and audit. Draft PR #3 updated with this report. | PR3_DEVELOPMENT_VALIDATION.md |

## Scope and limits

These are ten concrete implementation steps within the wider project; they do not close all eight remaining project workstreams. Independent provider verification, real ledger posting, paid/private entitlements, external community reconciliation and real browser/mobile/provider-session/staging checks remain open.

Module availability is operational configuration, not content privacy or an entitlement. Static/sample questions, notes, original PDF assets and external links already delivered to a browser cannot be recalled. A hidden navigation link remains directly reachable while enabled; pausing blocks supported portal/API delivery and new practice writes. Existing APPX/YouTube services are unaffected. Admin authoring/review/finance and account saving stay available. Pausing is reversible and does not delete content, assignments, enrolments, pending proposals or payment records.

Legacy databases without the settings table preserve prior availability and return a non-editable Admin migration notice. This compatibility fallback applies only to a missing portal_modules table; connection/query errors fail closed. Once the table exists, missing/unknown section rows do not enable anything. Explicit migration ordering and backups still require isolated staging validation before release.

The library's existing full-index endpoint remains compatible, so saved/withdrawn history and complete client search are not mistaken for page-local availability. The new API pagination is opt-in, and card pagination limits DOM size. This does not implement full-text/PDF indexing or remove the remaining large-catalogue metadata-loading work. Cursor pages reflect a live catalogue; refresh after concurrent publication edits for a fresh listing.

Learning reports cover saved website attempts across non-Admin accounts, not APPX/YouTube completion or a selected paid cohort. Repeated errors count one learner/question pair once when missed in at least two supported attempts. A rolling 168-hour window is used for practice activity. Unsupported records are excluded with a count; original attempts remain unchanged. Faculty remains a scoped capability on the Student role, not a third role.

Validation: 273 tests pass, zero failures/skips; type checking, lint, bundle syntax and build pass (33 application routes/twenty-one Admin APIs). Base plus nineteen local migrations preserve synthetic records, module settings/audits and clean foreign keys on reapplication. UI checks are automated form/navigation tests, not observed smartphone/browser QA. No merge, deployment, DNS, remote migration or live-site change occurred.
