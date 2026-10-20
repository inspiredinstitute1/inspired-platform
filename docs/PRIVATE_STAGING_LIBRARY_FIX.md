# Private staging library request correction

Observed 20 October 2026: the owner reported only Home in navigation and a persistent published-library loading message after successful Admin PDF upload/download and refresh. Admin readiness reported 20 migration files, 208 schema objects and PDF storage HEAD readable. These are owner-reported hosted checks, not independent browser validation.

Public-content fetches explicitly omitted cookies. An owner-private Sites gateway can require its session cookie even where the application endpoint is public. Change same-origin module, library, material and social fetches to preserve that session. No external origin receives credentials. Server permission checks and the draft/published PDF policy are unchanged.

A successful module refresh now reloads the learning catalogue, and a paused library no longer shows a loading message for a request that cannot run. New gateway bootstrap/refresh and paused-library regression tests pass; total 325 tests. Typecheck, lint and Worker build pass.

Uploads remain private drafts until explicitly published. Student-facing PDF discovery and separate Student-account authorization remain pending hosted validation. The correction is prepared as a saved staging candidate; deployment needs approval under the user's no-deployment instruction. Public Site, live database, DNS and GitHub main are unchanged.

## PDF metadata submission correction

The owner subsequently reported that selecting Published and saving returned to Draft. A read-only staging pdf_materials inspection found both uploaded records still at Draft, version 1. The metadata form includes an input named id. Browser form named-property lookup can shadow form.id with that control, so the delegated submit handler's e.target.id comparison fails. The handler now reads the form's id attribute through getAttribute. This applies to all delegated submit branches with the same potential collision. A regression runs the real submit listener with an id-shadowed PDF form and verifies prevented native submission, POST of published metadata, updated version and success display. All 326 tests, typecheck and lint pass. Hosted publication remains pending deployment approval and retest; no PDF status was changed by this diagnostic work.
