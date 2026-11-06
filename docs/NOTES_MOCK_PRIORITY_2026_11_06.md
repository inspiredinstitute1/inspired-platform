# Notes and mock tests — priority validation, 6 November 2026

Owner priority: notes and mock tests before other feature development. This batch starts from draft PR #3 commit `35d46e129782efa19d07f497afdd537989ee47e7`. Production, main, hosted records, sharing, DNS and infrastructure remain unchanged. No deployment was performed.

## Existing staging observations

The [existing staging website](https://inspired-pr3-private-staging-20261020.faceacademy01.chatgpt.site) opens in connected Chrome with its candidate banner and an Admin application session.

| Journey | Current evidence | Limit |
| --- | --- | --- |
| Notes catalogue/search | Six visible catalogue/published items; title/category search and filters worked in the prior check | Catalogue contains sample notes as well as supplied material; this does not establish that all intended teaching content is published |
| Homophones reader | All 100 sets displayed; searching `principal` returned set 090 with Principal/Principle | Source exam-reference labels remain explicitly unverified |
| Published PDF | HSTR detail page loaded; Download PDF completed successfully | This verifies one published file's delivery, not a complete bucket inventory or backup |
| Timed mock listing | Three existing model/acceptance papers listed; paid paper remained locked and existing submitted attempt offered View result | No new hosted attempt was started, code redeemed or existing answer changed |
| Submitted result | Existing model attempt showed 5 correct, 4 wrong, 1 skipped and score 4/10; all ten answer/explanation sections displayed | Existing submitted result, not a new Student run |
| Analytics | First load timed out and displayed raw browser abort text. A second navigation loaded the Admin cohort report; My own test results then loaded a private report with one finalized attempt and score 4/10 | Hosted latency/root cause is unverified; UI recovery improvements below are not deployed |

No live note bookmarks/completion, uploads/publication, paper imports/status changes, code issuance or attempt submissions were performed. Student/provider-session acceptance and physical-device validation remain separate.

## Confirmed defects and bounded fixes

1. **Focus refresh rebuilt open learning views.** Returning to the browser triggered progress sync followed by a full render. Timed mock answers exist in memory, so the render could discard an unsaved selection or in-flight save context. It also reset reader search/expanded state. The focus handler now continues account synchronization while preserving open mock, original-note, authored-note and PDF-reader views. Catalogue refresh and form protection remain intact.
2. **Analytics failure lacked recovery.** A timeout exposed `signal is aborted without reason` with no retry action. The analytics view now shows clear timeout guidance and a Try again button. Retry preserves the chosen cohort, own-results or selected-learner scope. Existing generation guards prevent older failures from overwriting newer reports. This improves UI recovery; it does not claim to fix the hosted latency that caused the observed timeout.

Two focus regressions and two analytics error/retry regressions failed against the prior source. A third analytics regression verifies that an old failed request cannot replace a newer successful report.

## Validation

- Targeted notes/PDF/material/mock/import/analytics/account-sync checks: **98 passed**, zero failures/skips.
- Full suite: **395 passed**, zero failures/cancellations/skips.
- TypeScript, lint, production Worker build, release-input audit and `git diff --check`: passed.
- Built Worker/local D1 role smoke passed during this batch, including exam import, publication/access, answer privacy, scoring, origin/account binding and notes/PDF authorization. It ran before the analytics retry UI addition; final UI changes passed the full tests and build afterward. Synthetic local identities are not provider sign-in evidence.
- New-commit GitHub CI must be verified after pushing this batch; CI does not deploy the candidate.

## Priority work remaining

1. Use the managing account/workspace for the existing staging project, confirm its audience and deployed revision, then deploy the reviewed fixes privately. The current Sites connection still cannot resolve the retained staging ID; source changes are not yet deployed.
2. Run a fresh real Student journey on that exact candidate: published note/PDF reading, bookmark/completion and reload; free timed attempt, autosave, focus changes, resume, submit, result and own-only analytics. Use an explicitly disposable staging test paper/account; do not consume a learner's real one-attempt entitlement.
3. Review and publish intended real teaching content through the existing draft/review workflows. Sample/acceptance content is not a production content catalogue. No content was published by this batch.
4. Close hosted backup/restore, target migration, physical Android/PWA/accessibility, capacity and owner public-release gates before launch. Local checks do not close those gates.
