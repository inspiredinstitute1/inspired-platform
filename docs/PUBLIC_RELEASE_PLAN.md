# Public release plan — pending approval

Prepared 20 October 2026. This is a review plan, not an instruction to execute a deployment, database change, merge, access change or DNS change.

## Targets

- Public project: appgprj_6ad2e15a9cb481918e728ea9c3075998, https://inspiredinstitute.in.
- Private candidate project: appgprj_6ad6d873b0288191b0ac6e3215524ee6. It has separate DB/R2 and owner-only access.
- Draft GitHub PR #3: development/inspired-3-modular-platform-2026-10-19. GitHub main is not the private-site source branch.

The latest read-only public schema observation contained learner_progress only. The private candidate has 48 tables. A successful private deployment does not make public schema migration complete.

## Prepare before requesting final release approval

1. Record the exact proposed source commit and saved artifact, public target, current deployed version and current migration history. Keep private test banners and synthetic fixtures out of the public candidate. Preserve the target's existing audience unless the owner explicitly approves a change.
2. Arrange one approved Student test account and narrowly scoped private-site access. Do not reuse owner credentials or broaden access to everyone as a shortcut. Run import/publish/code/attempt/refresh/submit/result tests in the hosted private environment. Local identity simulation is not provider authentication proof.
3. Verify the platform's trusted sign-in/gateway boundary using supported provider controls. Do not assume a locally accepted identity header can be supplied by an untrusted public caller.
4. Obtain supported hosted DB export/checkpoint and R2 recovery controls. Record backup time, access restrictions and a restore rehearsal into a separate approved target. A storage HEAD request or local recovery rehearsal does not satisfy this check. Do not place real learner backups or private question banks in GitHub.
5. Reconcile public migration history before applying schema. The base migration creates learner_progress without IF NOT EXISTS; do not replay it over the existing public table. The private combined migration journal is specific to its test history. Do not copy it blindly into the public target. Apply only the confirmed missing migrations through the supported target-specific workflow after backup and approval.
6. Review provider request/CPU/memory/database/storage limits against the expected learner load. Record measured hosted behavior and available capacity; local timings are not a hosted service guarantee.
7. Review mobile, accessibility and PWA evidence, including its listed limits, and the published content/access states for the initial release. Verify actual phone installation separately if installation is part of the launch promise.
8. Present the owner with the exact version/commit, scope of migrations, expected interruption, recovery checkpoint and rollback procedure. Obtain explicit public-release approval.

## Approved release sequence

After approval only: apply the approved target-specific migration/source workflow, save the exact public artifact, deploy once, inspect the returned deployment status, and perform bounded smoke checks. Do not change DNS when existing custom domains already point to the selected public Site. A merge requires its own authorization if it is not explicitly included in release approval.

If publication fails, inspect both deployment and migration state before retrying; database migrations may have executed even if the application publication failed. Application rollback does not undo schema or data changes. Prefer backward-compatible schema additions and forward fixes; never drop learner data as a rollback shortcut.

## Evidence already available

- 345 tests and build for analytics version 6; 348 after the mobile navigation fix.
- Private version 7 deployed and hosted keyboard regression verified.
- Full local built HTTP mock journey with synthetic identities and payment confirmation.
- Local 48-table recovery and four-PDF storage recovery.
- Mobile/PWA evidence in MOBILE_ACCESSIBILITY_PWA_2026_10_20.md.

All pending items must be assessed honestly. This plan does not claim that hosted backups, gateway security, payment-provider verification or a public launch have passed.
