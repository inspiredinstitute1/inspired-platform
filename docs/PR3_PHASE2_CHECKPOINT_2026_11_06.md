# PR #3 — hosting access and development checkpoint, 6 November 2026

## Latest continuation — staging browser access verified

This section supersedes the earlier browser-access blocker below. PR #3 was freshly verified open, draft and unmerged at `bd892e885cbcf3f9c1ccd88b1a3bdb12b9564fb6`; GitHub Actions run [#28](https://github.com/inspiredinstitute1/inspired-platform/actions/runs/42245898391) passed for that starting commit. The checkout was clean before this batch; `main` was `8b87502f44bf6d25eef6688846678761faad39cc`.

### Existing hosted staging — current observations

- The connected Chrome browser successfully opened [the retained staging URL](https://inspired-pr3-private-staging-20261020.faceacademy01.chatgpt.site). The page showed its private release-candidate banner, a working signed-in Admin application session, and the Admin review workspace. Application Admin access is not proof of Site management/editor permissions.
- The Admin System readiness panel reported **Application checks passed**, 22 expected migration files, 232 expected schema objects and readable PDF-storage HEAD. This checks expected object names and a non-writing storage probe; it does not verify SQL definitions, applied migration history, physical resource identity, object completeness, backups or restore.
- Notes loaded with six published/catalogue items. Search for `homophones` returned one matching note. The timed mock listing loaded; no attempt was started/submitted, code redeemed, PDF downloaded, note bookmarked or Admin form saved.
- At 390 × 844, notes search/filter controls and mobile navigation worked. The drawer opened and navigation closed it. Both light and dark themes displayed; no horizontal overflow was measured on the notes page. Theme and viewport were restored afterward. Inspected browser console warnings/errors were empty. This is desktop responsive QA, not a physical Android, PWA-install or screen-reader test.
- The exact staging `get_site` still returned `NOT_FOUND` / `project_not_found`; `list_sites(limit=50, include_editable=true)` returned no items and no cursor. Current management role, access policy, saved/deployed version and source commit remain unverified. The banner and authenticated browser visit alone do not prove anonymous access is denied.

### Small session-handling fix

After progress sync detected account expiry/change, the shared `accountFetch` helper still allowed new exam/analytics requests. Expiry first detected by an exam request also left the account status saying "Saved to your account" until another progress operation refreshed it.

`portal/cloud-sync.js` now rejects subsequent shared account requests before network access while the session is blocked, and immediately displays refresh guidance when a response blocks it. Original-account local progress is retained. Server authorization/account-binding checks remain authoritative. Two VM application regressions failed on the prior source and pass with the fix; these do not simulate a real provider account switch.

### Completed validation of this batch

- Frozen dependency installation completed; the installer's local store-path adjustment was restored. No dependency/lockfile, migration, hosting binding or Site identity change.
- Targeted account-sync/exam UI checks: 23 passed, zero failures/skips.
- Full suite: **390 passed**, zero failures/cancellations/skips.
- TypeScript, lint, production Worker build, bundle preparation, release-input audit and `git diff --check`: passed. The audit confirms the base plus 22 explicit migration inputs, expected build binding names and absent rehearsal flags; it does not approve a release.
- Built Worker/local D1 role smoke: passed, including anonymous/Admin/Student permissions, account isolation, exam import/access/scoring, origin rejection and retained audits. Gateway identities were synthetic, not provider-authentication proof.
- Disposable local D1 recovery: passed across **49 application tables**, exact rows/schema/audits/sequences, integrity, deleted-ID safety, migration reapplication and checkpoint restore into empty targets.
- Disposable local D1/R2 recovery: passed for **four synthetic PDFs**, exact bytes/keys/SHA-256/HTTP/custom metadata, PDF rows/audits and publication/privacy/corruption guards.
- New-commit GitHub Actions must be verified after this batch is committed; starting-commit run #28 is not CI evidence for the new change.

### Current completed-versus-blocked register

| Area | Status | Remaining evidence/action |
| --- | --- | --- |
| Source security and build | PASS within tested scope | Verify CI for this batch; broader assurance is not implied |
| Existing staging browser | PASS for inspected Admin/navigation/library/mock-list paths | Latest source deployment cannot be identified or updated through this Sites connection |
| Hosted D1/R2 | LIMITED read-only application readiness | Resolve managing account/workspace; verify physical bindings, applied migrations, complete checkpoint/object export and isolated restore |
| Real sessions | PARTIAL | Student, stale Admin/account-switch, expired provider session and two-device acceptance on the exact deployed candidate |
| Mobile/accessibility | PARTIAL desktop responsive QA | Physical Android install/relaunch/offline and screen-reader/keyboard acceptance |
| Capacity/operations | BLOCKED hosted | Hosted quotas, cold starts, monitoring and bounded staging capacity evidence |
| Public release | BLOCKED | Close recovery/migration/session/device/operations gates and obtain explicit owner approval |

No hosted deployment, production migration/data change, merge, DNS change, infrastructure creation, access-policy change or payment activation was performed. This batch's source fix is **not deployed** to staging. The existing hosted build was inspected separately from the locally built candidate.

## Earlier session checkpoint (retained historical evidence)

## Verified source and CI

PR #3 is open, draft and unmerged, targeting `main`. Inspection found development HEAD `680ebb0727025df86c2ea59e13e1578f4206e410`; main fetched as `8b87502f44bf6d25eef6688846678761faad39cc`. GitHub Actions run [#26](https://github.com/inspiredinstitute1/inspired-platform/actions/runs/41960646017) completed successfully for that development commit. This is prior-commit CI evidence, not validation of this checkpoint's changes.

The fresh development checkout was clean before work. Local Node is 24.22.1. The unchanged baseline full test suite passed 386 entries, zero failures/skips. Historical counts and deployment versions elsewhere remain historical.

## Phase 2 access evidence

- `.openai/hosting.json` retains public project `appgprj_6ad2e15a9cb481918e728ea9c3075998`, DB binding `DB`, R2 binding `BUCKET`. Binding names do not identify physical provider resources.
- Operations documentation retains staging project `appgprj_6ad6d873b0288191b0ac6e3215524ee6`.
- Native `get_site` returned `NOT_FOUND` / `project_not_found` for each exact ID in the selected account. `list_sites(limit=50, include_editable=true)` returned no items and no next cursor. This does not prove the projects were deleted or inaccessible to their owner in another account.
- Connected Chrome listed two ChatGPT conversation tabs and no open hosting/staging tabs. A direct ChatGPT navigation was rejected by the browser security policy's host restriction. No workaround was attempted.
- Current exposed Sites operations include database overview and bounded table reads, but no full SQL export/checkpoint, R2 object inventory/export or isolated restore operation. No database rows or object bytes were read.

**Blocker:** the selected Sites connection cannot resolve either retained project; browser policy prevents inspecting hosting through the connected browser. Current deployment/version, audience, Worker identity, physical DB/bucket mapping, permissions, retention and hosted recoverability are unverified. Required next access is a supported connection to the account/workspace containing these existing IDs, followed by operator-supported export and isolated restore controls. Do not create replacement infrastructure or infer separate Cloudflare-account ownership.

## Development defect and regression

A non-JSON HTTP 401 response caused JSON parsing to throw before the progress client marked the session blocked. Pending progress was retained, but sync could keep retrying instead of offering the intended refresh path. Boot had the same ordering issue.

`portal/cloud-sync.js` now checks status-based account expiration before parsing; `portal/cloud-boot.js` records expiration before parsing. Valid JSON account-change detection and same-account conflict reconciliation remain in place. Tests cover both pull/save responses, retained account cache, suppressed retries and boot expiration. The new sync regression failed against the original source at `assert(h.cloud.blocked)` and passes after the fix. These are VM application tests, not hosted identity-provider evidence.

## Progress register

| Task | Status | Evidence | Blocker | Next action |
| --- | --- | --- | --- | --- |
| Security | PASS within regression scope | Non-JSON 401 pause and cache preservation | Hosted sessions unverified | Real expired-session/account-switch acceptance after access |
| Database | BLOCKED hosted | Project lookups fail | Current managed DB identity/access | Resolve existing project and supported checkpoint |
| Hosting | BLOCKED | Both exact IDs return NOT_FOUND; listing empty | Selected connection cannot resolve targets | Restore correct account/workspace access |
| Storage | BLOCKED hosted | BUCKET declared in source only | No current object access/export control | Operator-supported complete inventory and backup |
| Admin features | NOT TESTED hosted this batch | Phase 1 handoff retained | Hosting access | Stale Admin/session acceptance |
| Student features | PASS within regression scope | Account-sync VM regressions | Provider/browser evidence | Real-session acceptance |
| Mock examinations | NOT TESTED hosted this batch | Existing tests retained | Hosting access | Recheck acceptance on actual candidate |
| Finance | NOT TESTED hosted this batch | No finance changes | Independent provider evidence | Keep real posting disabled |
| Mobile/PWA | NOT TESTED physical device | Existing automated suite only | Physical device evidence | Android install/relaunch/offline check |
| Accessibility | NOT TESTED screen reader | No new evidence | Screen-reader acceptance | Keyboard and screen-reader checks |
| Testing/CI | PASS prior CI; local tests pass | Baseline 386; changed suite 388, zero failures/skips | New commit CI must be verified separately | Run full dependency-based checks and CI |
| Release readiness | BLOCKED | Open recovery/session/device/capacity gates | Hosted evidence and explicit release approval | Close gates before release |

No deployment, merge, production migration/data write, DNS, access or infrastructure change was performed. No backup or restore was claimed.

## Completed local validation for this batch

- Project dependency installer completed successfully (640 packages downloaded); its local workspace-store rewrite was restored, leaving dependency inputs unchanged.
- `npm run test:all`: 388 entries passed, zero failures/cancellations/skips.
- `npm run typecheck`, `npm run lint`, `npm run build`: all exited 0. Production build completed without publication.
- `git diff --check`: passed. No migration, binding or dependency changes.
- New-commit GitHub Actions status must be checked after push; local success is not a remote CI result.
