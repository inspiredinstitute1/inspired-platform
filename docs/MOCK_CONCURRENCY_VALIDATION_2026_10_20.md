# Mock concurrency and failure validation — 20 October 2026

Development evidence only. Application code is unchanged from saved private version 8. This pass adds regression coverage and an expanded local HTTP rehearsal; no new deployment is required for the test files.

## Passed edge cases

- Parallel start requests retain one attempt for a learner/paper.
- Competing saves at the same version produce exactly one success and one conflict; refreshed answers match the winner, and the deadline is unchanged.
- Revocation between the initial access read and final save is enforced by the SQL guard; answers remain unchanged.
- An expired database deadline rejects a save even when the application clock is stale. Refresh finalizes the previously saved answers.
- A network interruption preserves unsaved choices and displays retry guidance. A subsequent version conflict requires refresh and does not silently overwrite the server state.

## Bounded local HTTP rehearsal

25 synthetic learner accounts used the actual built Worker, local D1 and local R2. Mock processing used two learner workflows at a time, with two competing saves each (up to four save requests in flight), not 25 simultaneous active learners.

Each learner started a ten-question synthetic free mock, submitted competing saves, resumed at version 2 with the original deadline, submitted final answers and read a private report. Every pair produced one save and one conflict. All 25 reports matched their result. The Admin cohort contained exactly 25 attempts/learners: 130 correct and 120 wrong answers, net 100 marks across 250 responses (+1/-0.25).

The same rehearsal checked 25 isolated progress accounts, four simultaneous 5 MiB PDF reads with exact byte hashes, and recovery after an oversized request. Total HTTP requests: 286. No local Worker memory-limit or stalled-request errors were detected.

356 automated tests and focused lint passed. The version 8 application build/runtime verification from the previous pass remains applicable because this pass changes only tests, the local rehearsal script and this report.

## Limits

This is not hosted load or capacity proof. It does not establish provider CPU/memory/database/storage quotas, actual Student sign-in, device/network behavior or hosted backup recovery. No real learner accounts, payment confirmations, question banks, hosted records, access policies, DNS or deployments were changed. Version 8 remains saved without deployment approval; version 7 remains the deployed private candidate.
