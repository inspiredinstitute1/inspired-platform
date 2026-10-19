# Learner matching and payment evidence review

Development scope on draft PR #3. Do not merge, deploy or apply production migrations without owner approval.

In the Admin workspace, save/select an import batch under Payment import review. Under Learner matching and evidence review, open an accepted row. Duplicate and rejected rows remain visible as source issues and cannot receive a review record.

Select a saved Student account and an existing course/test series independently. Imported studentId/courseCode fields are claims and are never automatically selected. Admin accounts cannot be learner matches. Draft, paused and archived programmes remain selectable for historical records; their status is shown. This does not enrol anyone.

Enter a reference to separately retained evidence and any review notes, choose a review status and give a change reason:

| Status | Meaning |
| --- | --- |
| pending | Matching or evidence work is incomplete. Either match may be empty. |
| reviewed | Admin recorded both saved matches and an evidence reference of at least three characters. Payment remains unverified. |
| disputed | A mismatch or concern needs resolution; incomplete matches are allowed. |

An evidence reference is plain text, not a proof upload or an independently verified statement. Keep source exports/receipts separately. This workflow does not fetch URLs, validate provider receipts, establish ownership or inspect evidence authenticity. Do not enter passwords, full card details or banking credentials.

Every save requires a reason. Matches, evidence and status may be corrected or reopened; immutable imported rows are never overwritten. The latest 50 audit changes for the selected batch show before/after values, server-derived actor and time. Reviews and audit cannot be deleted. Concurrent or stale saves receive 409 and leave input intact. Use Open / reload saved review to retrieve the newer version before reapplying changes. A lost successful response can also require this reload.

No review writes finance_transactions, posts revenue, verifies a payment, grants programme/APPX/group access or matches an activation fee against tuition. Reviewed ledger approval and independent evidence verification remain future work.

## Development implementation and checks

Admin-only GET/POST `/api/admin/finance-review`, private/no-store responses, same-origin JSON writes, bounded 8,000-byte bodies and server-side account/programme validation. Only accepted staging rows can be reviewed. Optimistic row versions protect create/update races; database triggers atomically retain before/after audits. Import-row identity and review/audit deletion are blocked.

Explicit `0012_finance_review.sql` follows the base and eleven Admin migrations, outside the generated Drizzle journal. Local validation applies/reapplies all twelve and checks synthetic row preservation/foreign keys. Seven service/database tests and three frontend tests cover access, required fields, manual matching, duplicate/rejected exclusions, actor spoofing, stale writes, audit rollback/retention, escaping, unsaved input and late batch responses. Built Worker/local D1 checks exercise review creation, reopening, stale conflicts and unchanged Student enrolments.

Only synthetic records were used. Actual provider sign-in, real browser/mobile interaction, remote staging and real evidence checks remain unverified.
