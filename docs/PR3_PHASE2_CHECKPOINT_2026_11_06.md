# PR #3 — hosting access and development checkpoint, 6 November 2026

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
