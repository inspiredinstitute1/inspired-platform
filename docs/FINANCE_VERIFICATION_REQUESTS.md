# Independent-verification request queue

This is the development intake workflow for independent evidence. It does **not** independently verify a payment, contact APPX/PhonePe, authenticate a statement, post revenue or grant access. No provider adapter is configured. Every response retains `verification=unverified`, `canPost=false`, `independentEvidenceAvailable=false` and `providerAdaptersConfigured=false`.

## Admin workflow

1. Select an imported batch, resolve its saved review/link rules and manual evidence decisions, and capture a current complete review-approved snapshot.
2. Below approval snapshots, record an independent-verification request with a reason. The server captures expected payment facts from the immutable snapshot. No screenshot, reference note or Admin-provided verification flag substitutes for independent evidence.
3. Inspect the retained expected facts and history. While awaiting a provider, record a dispute or cancel the request with a reason. Disputed requests can be cancelled; closed requests cannot reopen. Create a new review snapshot to start another request. One verification task is retained per approval snapshot.

The queue is preparatory intake, not a background job: nothing automatically fetches evidence. Expected claims include exact source/reference, kind, date, gross/fee/net paise, saved learner/programme, review version and original-payment target. The required currency is INR; this is an expected currency requirement, not confirmed provider currency. Selected rows and external original targets are distinguished. Earlier receipts require evidence but must not be recounted as new collections. Relevant peer facts remain bound through the referenced full approval scope.

A later review hold or review approval supersedes the request's binding even if its captured scope is unchanged. Supporting-record changes make it stale; monotonic counters prevent change-then-restoration from reviving a request. Disputed/cancelled status remains visible separately from the current/stale/superseded/unavailable binding. Old expected facts and events are never rewritten. Stale or unavailable tasks may still be disputed/cancelled so history can be managed safely.

Disputing/cancelling a verification request does not rewrite the earlier approval, manual evidence decision or saved links. There is no real posting path to enable. A future posting gate must require current independent evidence and honor verification disputes/cancellations. The separate synthetic journal remains a local mechanics rehearsal and does not consume this queue as verified proof.

## API and database

Admin-only, private/no-store `/api/admin/finance-verification`:

- `GET ?batchId=<UUID>` lists the latest twenty tasks and the currently requestable approval ID, when available. Missing `batchId` selects the latest imported batch. Summary lists exclude expected-claim payloads.
- `GET ?taskId=<UUID>` returns expected facts, binding status and latest fifty events.
- `POST` with `action=request`, `requestId`, `approvalId` and `reason` creates the immutable task and its initial `awaiting_provider` audit event atomically.
- `POST` with `action=dispute|cancel`, `requestId`, `taskId`, observed `version` and `reason` appends a lifecycle event. Optimistic versions reject conflicting changes. There is no verify/confirm/authenticate action.
- `DELETE` and update/delete history are forbidden. Identical retry IDs recover committed events, including concurrent identical requests; different input under the same ID conflicts. Actor, expected items and state are server derived.

Migration 0018 creates `finance_verification_requests`, append-only `finance_verification_events` and a deterministic expected-facts view. Task creation revalidates complete current scope and the latest review decision in the same database write, with a matching database trigger. Initial audit failure rolls back the task. Database guards restrict event order and the three permitted states, preserve history and reject forged expected claims. Requests never write real finance transactions, enrolments or community membership.

The expected-facts policy is `independent-evidence-request-v1`. The binding uses `review-snapshot-v1`; changes to its SQL/policy require corresponding migrations for the approval, rehearsal and verification guards. These explicit migrations remain outside the generated Drizzle journal.

## What remains

An actual trusted provider integration or separately agreed independent cash/manual checking workflow is still needed. It must authenticate evidence provenance, retain immutable evidence identity/version, bind every expected fact and relevant relationship, handle disputes/corrections/replays, and revalidate the latest evidence and review approval atomically before any real ledger posting. This milestone does not establish that any provider supports a particular API/export or currency/fee convention. Do not enter credentials or provider secrets in request reasons or evidence-reference fields.

## Validation

Fifteen new service/database tests and five Admin form tests cover permissions/origin/bounds, exact expected claims, external originals, idempotent retry/concurrent recovery, scope/hold races, event-version conflicts, stale/restored/unavailable bindings, rollback, immutable history, migration reapplication, escaped markup, retained form inputs, pending-save guards and late-response protection. All data is synthetic. Full suite: 255 passing tests; type checking, lint, bundle syntax and build pass (31 routes/twenty Admin APIs). Base plus eighteen local migrations preserve task/event records on reapplication with no foreign-key violations. Built Worker/local D1 validates task creation, expected claims, superseding holds, disputes/cancellations and unchanged Student access. Actual provider sign-in, browser/mobile and remote staging remain unverified.
