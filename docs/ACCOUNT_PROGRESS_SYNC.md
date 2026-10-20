# Account-bound progress sync

Development implementation on draft PR #3. Only Admin and Student base roles remain. No new identity provider, entitlement or migration is introduced.

## Account precondition

The page's server-provided identity selects its account cache. All boot and later progress requests send `x-portal-account-id: encodeURIComponent(pageUser.id)`. The server compares this with the independently authenticated request user before database lookup or body parsing. The header never authenticates a user or selects another user's database row.

- Missing identity: 401, as before.
- Supplied account ID differs from the current authenticated session: 409 with `code: ACCOUNT_CHANGED`, no user details, payload or reconciliation base. No database read/write occurs.
- PUT without the account header: 428 with `code: ACCOUNT_REQUIRED`, asking the client to refresh. Previously loaded clients cannot save until refreshed.
- GET without the header remains a compatible session-scoped reader. The current portal always sends it.
- A normal stale-version 409 includes the authenticated same-account identity and current payload/version so the client can reconcile safely. A matching header still requires normal authentication, same-origin JSON writes, validation and optimistic version checks.

## Client behaviour

Before boot data or save/conflict responses can enter reconciliation, the client validates account ID, current base role, nonnegative safe-integer version and the main progress container shapes. This is an envelope check; the server remains responsible for detailed progress validation and score computation.

401, ACCOUNT_CHANGED and responses identifying another account/role pause progress sync for the life of the page. The status offers Refresh account and suppresses automatic retries and the Try again action. Pending work stays under the original account's existing local-storage key; this does not copy work into the replacement account or delete the original copy. Changes made while paused also remain locally scoped. Refresh selects the new server identity and its cache; returning to the original account lets its pending work reconcile normally.

Malformed envelopes, invalid JSON, network failure and timeouts retain pending state without accepting a new reconciliation base. Ordinary same-account optimistic conflicts and changes made during an in-flight save still reconcile and save. The ten-second request timeout now covers JSON body consumption as well as response headers. Boot has its existing eight-second bound.

Anonymous boot reads guest storage and does not request account progress. Intentional guest import remains the existing explicit sign-in flow. Device caches are retained, not encrypted or remotely wiped. This is not a complete shared-device privacy feature or server-side session-revocation system.

## Validation and limits

Sixteen new service/UI regression entries cover pre-database rejection, required write binding, unauthorized access, forged body identity, normal version conflicts, opaque ID encoding, request headers, changed sessions/roles, malformed/failed responses, edit/save races, body-read timeout, boot isolation, refresh status and guest-only boot. UI tests execute source in a VM harness; they are not real-browser tests.

The built Worker/local D1 smoke sends trusted synthetic identity headers to simulate an old tab after a session switch. Mismatched GET/PUT returns no progress, missing write binding requires refresh and both account rows retain their prior versions. This validates application logic only. Real provider sign-in, gateway header sanitization, account switching in browsers, two-device sessions and mobile layout remain unverified. No hosted actions or real accounts were changed.
