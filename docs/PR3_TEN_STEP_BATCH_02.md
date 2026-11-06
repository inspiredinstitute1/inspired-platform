# Ten-step social/community batch — 20 October 2026

Development only, on draft PR #3. No external roster import, provider synchronization, real payment verification, access grant, group addition/removal, merge, deployment, DNS change or live-site edit was performed.

| Step | Delivered result |
| --- | --- |
| 1 | Migration 0020 gives existing social/group/member rows a labelled baseline and captures every later create/update/delete in append-only before/after history. No old state is invented. |
| 2 | Social changes require a reason and observed version. Stale edits/deletions conflict; physical link removal retains private audit history. Public footer responses still expose only safe enabled destination fields. |
| 3 | Community group records support versioned metadata/tier/availability edits. New groups remain disabled. No operation changes the external group itself. |
| 4 | Membership edits use observed versions, unique group/account pairs and atomic data/audit batches. Concurrent creates cannot silently overwrite an existing record. Manual verification timestamps are cleared on changes. |
| 5 | New records require saved Student accounts; bounded literal account search excludes the current Admin. The account check repeats inside new membership insertion. Legacy unmatched records remain available for review. |
| 6 | Group-filtered roster pages use immutable membership-ID cursors, a validated size of 1–200 (UI 100), explicit matching totals and loaded-page findings. Group lists explicitly warn above 500. |
| 7 | Review flags identify unmatched/Admin accounts, mock-only membership in premium groups, confirmed records in disabled groups, unresolved manual classifications and independently unverified “paid active” labels. Flags do not add/remove members or prove payment. |
| 8 | Admin-only audit browsing supports kind/record filters, 1–100 entries per page (UI 50), immutable-ID cursors and retained snapshots after deletion. Nothing exposes audit/member data publicly. |
| 9 | Frontend guards preserve unsaved reason/account/version on failure, suppress pending repeat saves, ignore late history/roster/search responses, escape labels/snapshots and preserve the chosen group when roster options reload. |
| 10 | Regression, lint, types, build, local Worker, twenty-migration reapplication and 42-table recovery checks pass. This report and the changed code are retained on draft PR #3. |

## Audit semantics

`governance_audit` retains a monotonic per-kind/record version and exact base-table JSON snapshots. Direct SQL writes are labelled `database` / `Unattributed direct database change`; migration baselines are labelled `migration`. Neither label claims a human approved earlier records.

API writes use a single D1 batch: install the server-derived actor/reason/time context, apply a version-conditional mutation, then clear context. Database triggers generate the audit from actual old/new values. Batch failure rolls back both data and context; successful/no-change batches leave no context row. A stale version changes no data and produces no mutation audit. Direct SQL administrators are outside application authorization; context is not a substitute for database access controls.

Deleting a social link removes its current public record only; its URL and private audit snapshots remain retained for Admin review. Community records are edited/disabled rather than deleted. No third portal role is introduced. External paid-group invitations remain private unless explicitly published through the existing social-link manager.

## Remaining scope

This is a local record-review workflow, not an external WhatsApp/Telegram membership API or authoritative payment reconciliation. A “confirmed manually” membership and “paid active” classification remain unverified. Even legacy verified_at values do not establish independent verification; API responses explicitly state independentlyVerified=false and providerSynced=false. Mock-only classification is excluded from premium-group expectations as a finding, not an automatic external removal.

Legacy unmatched memberships can be reviewed without losing history, but new unmatched/Admin records cannot be created through this API. Identity retention/corrections and mapping external people to accounts still need reviewed import/provenance workflows. Groups beyond the newest 500 need further group search/pagination. Roster totals cover matching records; discrepancy findings cover the loaded page only.

Real provider evidence, paid entitlements, live community integrations, authenticated browser/mobile/two-device verification, hosted staging/D1/R2 recovery and owner-approved release remain pending.

## Validation

286 tests pass (thirteen added service/database/UI regressions), zero failures/skips. Type checking, lint, bundle syntax and build pass (34 application routes/twenty-two Admin APIs). Built Worker/local D1 validates retained deletion audit, optimistic changes, account choices, mock-only findings and paged history. Base plus twenty explicit migrations apply/reapply without foreign-key violations; governance context is empty after writes. Local recovery now covers forty-two application tables, exact rows/schema/audits, migration reapplication, checkpoint restore and restored governance/finance/module/practice guards. All fixtures are synthetic. No real browser/mobile or external-group operation was tested.
