# PR #3 development validation — 19 October 2026

Branch: `development/inspired-3-modular-platform-2026-10-19`.
Runtime: Node 24.19.0, pnpm 11.25.0. Also validated in a separate checkout with a fresh dependency installation from the shared package cache.
All execution was local; no production database, deployment, DNS or main-branch changes.

## Results

| Check | Result |
| --- | --- |
| `npm run test:all` | 27 test entries passed, zero failures or skips. Covers authorization, origin checks, scoped progress/scoring, PWA caching, reconciliation, database-backed admin services, bounded request-body handling and Admin form/preview state. |
| Clean dependency installation | `pnpm install --offline --frozen-lockfile --store-dir /workspace/.sites-runtime/pnpm-store --reporter append-only` restored all 640 packages in a separate checkout, with native postinstall completion and no lockfile changes. Uses cached package/policy metadata; does not verify fresh registry/network access. |
| `npm run typecheck` | Passed. Finance preview response helper now has an explicit `unknown` body type. |
| `npm run lint` | Passed with no warnings. Added the missing ESLint 9 flat configuration; generated files are ignored. The retained shell's intentional public CSS links have a file-scoped exemption. |
| `npm run build` | Passed all five Vinext/Vite build stages and emitted all seven application routes. This builds artifacts without publishing them. |
| `npm run test:db:local` | Passed against Wrangler's local D1 implementation, using a fresh state directory and placeholder database ID. Applied the base migration and all three admin migrations; reapplying the admin migrations preserved synthetic records. Foreign-key check returned no violations. |
| `npm run test:runtime:local` | Passed against the built Worker running locally: homepage, bundle, manifest, service worker, offline page and legacy redirect. Anonymous requests to all four admin APIs and the progress API were rejected with private/no-store responses. |
| `npm run test:roles:local` | Passed through built Worker routes and real local D1 using synthetic gateway identity headers: owner/student role rendering, all Admin API permissions, progress save/reload and cross-user isolation, stale-version conflicts, Admin exclusion from learner counts, social CRUD, community upsert, origin rejection, finance size/row limits, duplicate and invalid-amount handling. This does not verify provider sign-in. |
| `git diff --check` | Passed. |

Additional in-memory SQLite tests exercise social-link create/read/update/delete, community group enabling and membership upsert, migration integrity, duplicate transaction references, negative amounts and invalid foreign keys. These service tests use a D1-shaped adapter; they do not establish provider-authenticated browser behavior.

## Changes

- Fixed strict TypeScript compilation in the finance preview handler.
- Restored executable modes for the shell build/install/environment entry points.
- Added repeatable database, local Worker and type-check commands.
- Added persistence and migration regression tests and ignored incremental TypeScript build metadata.
- Added the missing ESLint configuration.
- Fixed a reproducible request-stream lifecycle failure: early rejection of writes could leave the incoming stream active after response and cause local Worker 503s. The Worker now buffers API bodies within route-specific byte limits before handing them to Vinext; modest rejected bodies are drained, with a global 2 MB transport cap. Oversized transport bodies are cancelled instead of drained without bound. No write retries were added. Unit tests cover both declared and streamed limits; the local runtime regression verifies rejected writes followed by successful finance preview and checks for stream lifecycle errors.
- Applied existing form-field styling and larger mobile text to all three Admin managers; added scoped field widths, textarea styling, focus outlines, checkbox layout and wrapping for long URLs/buttons, using both theme palettes.
- Guarded social/community form saves against repeated submission while pending; original disabled states are restored on success or failure.
- Clearing a finance preview now aborts its request and ignores late responses, including when a new preview has already started. Malformed arrays and more than 200 rows are rejected before sending.
- Social link records now say Enabled/Disabled rather than implying publication; the public feed remains incomplete.
- Added four frontend state regression tests using a small in-memory test harness. They are unit tests, not real-browser layout or accessibility validation. The generated portal bundle also passes `node --check public/portal.bundle.js`.

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

## Remaining release checks

- Provider-authenticated Admin/Student browser sessions and mobile UI interaction remain unverified in this pass. Anonymous local HTTP checks and service-level identity simulations passed.
- Clean cached dependency installation passed; an exact Node 22 run and fresh registry installation were not performed. Tests used Node 24.19.0.
- Remote staging/production migrations were not run. The three admin migrations remain explicit SQL files under `docs/migrations/`, outside the generated Drizzle migration journal.
- Existing incomplete features remain: published social-link feed, audit logging, learner identity linkage, verified payment import/reconciliation and full-directory pagination. Synthetic membership/payment statuses do not verify real payments or grant external group access.
- Keep this PR a draft. Production migration and release require owner approval and the separate staging/backup checks.
