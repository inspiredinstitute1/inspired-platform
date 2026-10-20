# Paid mock exams — development candidate

This candidate adds Admin paper importing and signed-in learner timed exams. It is not live and does not authorize deployment or changes to real payments.

## Owner workflow

1. Open Admin → Mock tests · papers and paid access.
2. Download the CSV template or upload JSON; enter title, duration (1–240 minutes), paid/free access and reason.
3. Preview every question and correct answer, save a private draft, then review and publish its status.
4. Confirm the payment on your phone. Select the paid paper, learner's exact sign-in email, access days (1–365) and payment reference. Check the payment confirmation box and issue a code.
5. Copy the code shown once and send it privately yourself. The application does not send messages or verify payment providers. Revoke a lost code before issuing a replacement.

## Learner workflow

Open Timed mock tests (on mobile: Tests → Open timed and paid mock tests). Sign in using the existing ChatGPT sign-in, redeem the code, then start. This version does not create separate username/password credentials. Each code is one use and bound to one email and paper; each account has one scored attempt per paper.

The timer continues through navigation, refresh and disconnection. Saved answers resume. At expiry the server finalizes only answers received before the deadline; late answers do not count. Offline changes cannot be guaranteed saved. The screen reports save failures; use Save answers now while time remains. Concurrent-tab conflicts require reloading the server's latest saved answers.

Scoring is fixed at +1 correct, −0.25 wrong and 0 skipped. Explanations become available only after final submission. Admin sees the latest 100 attempts; learner results are separate from the older free-practice progress charts. There is no automatic leaderboard or provider payment reconciliation.

## Import contract

CSV headers: question,option1,option2,option3,option4,answer,solution. Optional passage. Quote commas/newlines and escape quotes according to CSV rules.

JSON: array (or an object with questions array) of objects containing question, options (four distinct strings), answer (integer 1–4), explanation, optional passage. Maximum 250 questions and 1 MB input file. UTF-8 Kannada and English supported. PDF/Word source papers require conversion and review before import. Publishing does not establish PYQ authenticity.

Questions, duration and access mode are immutable after import; use a new edition for corrections. Pausing a paper or revoking access blocks active use. Codes expire from issuance, not redemption. A replacement redeemed code replaces the prior entitlement and expiry. Submitted results remain readable by their owner while the practice module is enabled.

## Data and validation

Migration 0021 adds six exam tables, private paper data, hashed access codes, account entitlements, attempt state, redemption limits and append-only audit. Codes use a random UUID-derived secret and are returned once. Raw codes and paid answer keys are not shipped in the public bundle. Server checks enforce trusted account identity, Admin authorization, request origin, code ownership/expiry/revocation, optimistic save versions and database-time deadline conditions.

Development validation includes full regression tests, dedicated backend authorization/timer/code tests, UI autosave/account-switch tests, type checking, linting, production build and local-only D1 migration application/reapplication. Hosted browser and multi-account gateway checks remain pending. No live migration, deployment, real code issuance or payment import is part of this candidate.
