# Domain migration checkpoint

## Prepared state

- Existing GitHub main: 1d251abb6fcb9613c1a9c2fe7288c05b5744a829.
- Exact backup: backup/before-learning-portal-2026-10-18.
- Replacement matches tested Sites source 1c94ff0be3603fd582c54a03eee1e88cefbac697, except repository documentation and the retained CNAME marker.
- New deployment: https://inspired-learning-portal.faceacademy01.chatgpt.site.
- Final addresses: https://inspiredinstitute.in/ and https://www.inspiredinstitute.in/.
- Both hostnames are registered with Sites; verification, routing and HTTPS activation remain pending.
- No registrar DNS change has been saved. GitHub main still has its original pages.

## Release order

1. Resolve the unfinished GoDaddy form restriction. One TXT record was staged and a second row was empty at the last successful observation. No save completed. Automatic approval review blocked further GoDaddy access, including cancelling the form. Do not bypass this block through another tool or browser.
2. After the restriction is resolved, obtain current validation records from native Sites controls and add those verification records at the registrar. Preserve nameservers, SOA, domainconnect, DMARC and email settings.
3. Complete the approved routing switch using the exact A/CNAME targets returned by Sites. Confirm both hostnames are active and HTTPS is valid.
4. Validate anonymous notes/PDF/test, video and APPX routes, both themes, optional sign-in and saved account progress at the final domain. Check returning visitors can see the new portal despite the legacy service worker.
5. Release the legacy GitHub Pages custom-domain claim through supported hosting controls and merge this prepared replacement after the new domain works. Merging early removes the old Pages entry point and could interrupt the old site.

## Rollback

The original GitHub Pages source remains on main and the backup branch until migration. For a later rollback, restore the captured pre-migration DNS routing and preserved Pages source, verify the domain claim and HTTPS, and preserve the Sites student database.

No live credentials or student records are included. Obtain DNS verification values afresh from Sites rather than reusing a stale checkpoint.
