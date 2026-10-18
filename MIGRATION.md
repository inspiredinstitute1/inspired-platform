# Domain migration checkpoint

The portal is live at https://inspiredinstitute.in/ with an active HTTPS certificate. The final-domain browser checks passed for anonymous notes and homophones search, the test catalogue, test start and Previous/Next navigation, video and APPX routes, progress navigation, persistent light/dark switching, the legacy /index.html redirect, and Sign in with ChatGPT with account saving and server-selected Admin access. No test was submitted for QA.

Both inspiredinstitute.in and www.inspiredinstitute.in now have native Sites status active, provider status active and SSL status active. Both URLs loaded the new portal in the connected Chrome browser over HTTPS. Anonymous access was checked again after signing out of the owner account. No browser security warning was bypassed.

## Source and hosting

This source matches deployed Sites commit d0021224d86758b15bdfaad7b071b164214a66aa, excluding private operational snapshots and with repository-specific documentation and the retained CNAME marker. GitHub retains the source; the Vinext Worker, Sites-managed sign-in and D1 database run on Sites. This is not a GitHub Pages static export. Retiring the old Pages publishing configuration is separate from the successful DNS routing switch and should preserve access for visitors with cached old DNS while propagation completes.

GoDaddy saved both platform-issued apex A targets and the www CNAME with 600-second TTLs. Four validation TXT records were saved. Original GitHub A records were removed or replaced. Nameserver, SOA, domainconnect and DMARC records were preserved. Runtime credentials and student records are excluded from GitHub.

## Backup and rollback

The exact previous site is preserved at backup/before-learning-portal-2026-10-18, commit 1d251abb6fcb9613c1a9c2fe7288c05b5744a829. To roll back a future hosting change, restore the captured pre-migration DNS routing and the preserved Pages source, verify custom-domain and HTTPS state, and preserve the Sites student database. DNS verification values must be obtained from current Sites domain controls rather than stale copies.

The production Worker build and legacy-worker checks passed. The unchanged quiz layout was previously verified at 320/360 pixels; the final-domain browser's viewport override did not resize its page, so phone emulation was not re-verified during this DNS switch. Actual two-device account saving remains a separate acceptance check.
