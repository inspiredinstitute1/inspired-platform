# Payment and community readiness — outstanding inputs

No provider adapter, independent payment verification, real posting, paid entitlement, external roster sync, invitation or removal was executed. These cannot be made true by adding a flag to an Admin record. The existing request queue, immutable review snapshots and local journal stay preparatory and unverified.

## Evidence needed before implementing a trusted adapter

| Input | Why needed | Current status |
| --- | --- | --- |
| Owner-authorized APPX/PhonePe export or supported API documentation/access | Identify actual source format, reference uniqueness, statuses, currency, fees, refunds and settlement facts | Not provided/verified in this task; no API capability assumed |
| Redacted representative samples, including coupon activation, tuition, mock-only, refund and correction cases | Build a field mapping and tests against real format semantics without inventing columns | Pending; existing normalized synthetic CSV is not a provider specification |
| Independent provenance and retained evidence identity/version | Prevent a manual label, screenshot note or review approval from authenticating itself | Pending; existing manual decisions explicitly remain unverified |
| Exact fee/refund/settlement policy and accounting direction | Distinguish gross collections, platform fees, activation receipts, refunds and net settlement | Must be confirmed against source records; observed historical examples are not universal rules |
| Reviewed account/programme mappings and initial-ledger baseline | Avoid matching people by name alone, duplicate collections or recounting cross-batch originals | Manual website matching exists; real mappings/previous-ledger reconciliation pending |
| Approved entitlement and correction/revocation policy | Define paid access separately from payment import and preserve disputed history | APPX delivery remains separate; website paid delivery is not enabled |

A future adapter must preserve raw provenance securely, validate exact expected facts/currency and relevant relationships, retain immutable evidence versions, handle retries/corrections/disputes, and revalidate current approvals/evidence atomically before any real ledger write. Keep independent verification, ledger posting and access delivery as separately reviewed gates. No real revenue report may relabel unverified staging/journal values as verified collections.

## Community inputs and safeguards

Confirm each actual group's owner, intended public/private audience and supported consented access/export method. WhatsApp, Telegram and website chat need individual capability checks; no universal roster API is assumed. Link consented external identifiers to saved accounts through reviewed matches, resolve duplicates/unmatched people and keep review history. A saved website group or confirmed manually/paid_active flag is not external membership proof.

The agreed mock-only rule remains: ₹199 mock-test-only purchases do not establish premium WhatsApp eligibility. Tuition plus a small APPX coupon activation must not be double-counted as two tuition payments. Existing flags report discrepancies without making external additions/removals or access changes. Any future reconciliation must preserve those distinctions while authenticating actual source records.

A public link must have an explicitly reviewed destination and audience. Valid HTTPS/platform host syntax and an active domain do not prove destination ownership or public intent. Private invitation tokens and rosters must not enter source control. The live metadata overview currently shows no PR #3 social/community tables, so this task did not read or verify a saved live roster/link dataset.

## Work that can proceed without those inputs

Local service tests, normalized synthetic parsing, audit/versioning, stale-scope protection, manual review UI and operational readiness checks are implemented. Provider-specific authentication/mapping and authoritative money/access/group actions remain blocked until the corresponding inputs and authorization exist. This document is a concrete handoff checklist, not provider setup or financial verification evidence.
