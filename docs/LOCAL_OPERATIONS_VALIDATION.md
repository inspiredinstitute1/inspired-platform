# Local operational validation — 20 October 2026

Development only on draft PR #3. No browser work, hosted storage changes, deployment, merge, DNS, live-site edit or real learner/payment action.

## Clean checkout and fresh dependency installation

A detached checkout of candidate base `6de9d8767d026bc742046de782a84c1ae9835018` was created with no copied node_modules, generated catalogue/shell/bundle, build output or runtime data. Its ignored local execution profile was explicitly set to managed-linux for this managed environment. The candidate source patch for this milestone was subsequently applied there and validated against the independently installed dependencies; no dependency/generated files were copied from the working checkout.

The first offline frozen-lockfile attempt against the shared cache failed with ERR_PNPM_NO_OFFLINE_META for @alloc/quick-lru's policy metadata. That is a cache-completeness limitation, not evidence of a bad application dependency. No policy was disabled and the failure is not counted as a successful offline install.

A fresh, empty checkout-local pnpm store then installed successfully from the public registry using `pnpm install --frozen-lockfile --store-dir <fresh-store> --reporter append-only`. It downloaded all 640 packages, passed the 842-entry policy check and completed the esbuild, workerd and native resolver postinstalls. Dependency versions and pnpm-lock.yaml stayed unchanged. This verifies a fresh network-backed install in this environment; it does not repair or certify the shared offline cache.

Tested toolchain: Node 24.19.0 and pnpm 11.25.0. `.node-version` now records that tested Node version; packageManager retains the existing pnpm pin. A hosted builder's actual toolchain still needs confirmation rather than assuming it honors the file. The ignored managed-linux profile is local execution configuration, not a change to hosted identity or environment secrets.

The final patched checkout passed 312 tests, type checking, lint, the 34-route build, the new concurrency rehearsal and release-input audit. The primary checkout also passes its full local role smoke and base-plus-twenty migration application/reapplication checks with clean foreign keys. No schema change or dependency upgrade was needed.

## Bounded local concurrency

Run after building:

```sh
npm run test:concurrency:local
```

The script accepts no arguments/remote target or load overrides, checks the placeholder DB ID/local bucket binding, applies the base plus all twenty migration files to a disposable state directory, and starts the built Worker on loopback. Startup, CLI and fetch operations have time limits; the Worker is terminated in a finally block. All identities/documents are synthetic. A manifest is written under `.wrangler/pr3-concurrency-*`.

The successful primary run performed 133 requests:

- 25 separate Student identities, up to five progress requests in flight; saved names/goals re-read under the same identity.
- Two simultaneous updates against version 1 for every account, with two accounts active at a time: exactly one 200 and one 409 per pair. The retained version-2 state matches the successful writer; no cross-account data appears.
- One generated 5 MiB PDF uploaded and published by synthetic Admin; four simultaneous public downloads each match the exact returned byte count and SHA-256. These are application integrity checks, not full PDF parsing/malware screening.
- A progress body of 2,000,001 bytes rejected with 413, followed by a successful read of the unchanged account/version.

Local progress timings in that primary run: 126 samples, p50 18 ms, p95 34 ms, maximum 66 ms. These numbers include JSON body consumption but exclude PDF timing/startup. They are single-run local observations, not a benchmark promise, capacity estimate or release threshold. Hosted CPU, memory, request/storage quotas, cold starts and real traffic remain unmeasured. Twenty-five accounts were exercised; the test does not claim twenty-five simultaneous requests.

## Discovered failure and fix

The first end-to-end overload attempt exposed a local HTTP lifecycle issue: workerd logged a 413 for a just-over-limit request, but the client timed out instead of completing and reaching the next read. Immediate cancellation before consuming a small overflow was the trigger in this local path.

The API buffer now permits discarding at most an extra 64 KiB beyond its existing transport cap. The accepted route/body limits are unchanged: 2,000,000 bytes for general API transport, 6 MiB for PDF multipart transport, and the smaller existing per-route limits. Overflow bytes are never forwarded to a service or retained in the assembled request. Previously accumulated chunks are released after crossing the route limit. Declared or actual bodies beyond the discard cap still cancel rather than drain without bound.

Two regressions cover completing a small declared overflow and rejecting a misleading declaration once actual bytes exceed the absolute discard cap. The real local Worker rehearsal now completes the 413 and subsequent healthy request. This does not promise graceful completion for arbitrary giant, endless, failed or slow uploads; ingress/time/connection behaviour still needs hosted verification. The 64 KiB allowance is bounded discarded input, not a larger accepted upload size.

## Still pending beyond browser work

- Approved isolated hosted staging, target-specific storage bindings and all migrations; actual hosted D1/R2 export/restore and operational permissions/recovery procedures.
- Hosting gateway identity-header protection and actual provider authentication; caller-supplied synthetic headers prove only application logic.
- Hosted build toolchain, CPU/memory/quotas, request ingress limits, cold starts, logging privacy, backups/recovery objectives and monitoring.
- Review of actual enabled social URLs/public intent before any release.
- Independent APPX/PhonePe evidence, real reconciliation/ledger/paid entitlements and supported consented community integrations. Existing manual website classifications and local journals do not provide these.
- Owner approval before any merge, deployment, remote migration, DNS or live-site change. The prepared staging proposal remains unapproved; no approval is inferred from continuing local work.
