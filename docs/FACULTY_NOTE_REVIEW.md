# Faculty note submission and Admin review — development only

Migration `docs/migrations/0009_faculty_note_review.sql` follows the base and eight explicit Admin migrations. It creates new tables and idempotent triggers without enabling any existing account. This work uses synthetic local records only; no live migration, assignment or publication was performed.

## Permissions

Admin and Student remain the only base roles. A saved Student account needs an enabled faculty course assignment and a separate enabled submission permission. Submission permissions default to absent/disabled, so existing teaching access remains read-only. Admin manages the separate permission in Faculty note review, selecting the existing assignment and entering a change reason.

Either revocation blocks proposal reads and writes on the next request. Reads join current grants in one query; mutations include current permission predicates in the writing SQL statement. A form already open does not authorize a write. Re-enabling both permissions restores access to retained own proposals; neither operation deletes history. Admin can still review submitted proposals after the author's access is revoked.

## Faculty workflow

In Teaching workspace → Your draft note submissions, choose an enabled course, title, category, plain-text body and reason. Save the first version as Draft. Draft text supports English/Kannada, up to 20,000 characters and a 100 KB encoded request. Select Submit to Admin for review in a later versioned save.

Faculty can revise only their own Draft records, not another faculty member's work, existing Admin notes or course records. Submitted text is locked. Admin feedback appears to the author if the proposal is returned. Save revisions and resubmit. Accepted/rejected proposal snapshots are terminal; use New draft for another proposal.

Faculty responses contain their own text, status and intended feedback, without other authors, account contacts or private audit history. All responses are private/no-store; user/course query parameters cannot widen scope.

## Admin review

Open Faculty note review and inspect submitted text and course. Select a proposal to review, then enter feedback/reason (shown to the author):

- Return for changes moves it to Draft so the author can revise while authorized.
- Reject retains a terminal snapshot and does not create a library note.
- Accept as Admin draft creates a separate Draft note in Create study notes and a disabled/hidden link to the proposal's course. It does not publish content. Check/edit the Admin draft, publish it explicitly and enable its programme link separately when appropriate.

Optimistic versions prevent duplicate/stale acceptance. A single SQL update triggers acceptance, material/link creation and all associated audits atomically. If any dependent operation fails, no partial acceptance, note or link is retained. Proposal identity and submitted text cannot be changed during review. Accepted/rejected snapshots, proposal history and permission history cannot be physically deleted or rewritten.

No direct faculty editing of existing notes, public publishing, uploads, finance, enrolments or owner controls is granted. New submissions do not activate paid or APPX access. The faculty proposal remains an immutable accepted source after Admin edits its separate library copy.

## Validation and remaining checks

Eight service/database tests and three frontend regressions cover scoped ownership, opt-in defaults, review feedback/resubmission, conflicts, revocation at mutation time, text escaping and rollback on material/resource/proposal audit failures. Local built Worker/D1 checks verify the same flow with long Kannada text and a hidden accepted note. Base plus nine explicit migrations pass application/reapplication, record preservation and foreign-key checks.

Provider sign-in, real browser/mobile interaction and remote staging remain unverified. File delivery/uploads, pagination/search and a revision model for existing published/shared notes remain future work. Admin note publication currently requires a separate action but is not a mandatory multi-person approval system.
