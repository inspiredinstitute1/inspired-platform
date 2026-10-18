# InspirED Institute learning portal

The next portal for https://inspiredinstitute.in: free notes, tests and video classes on the website; premium content through the existing APPX Android app.

## Student experience

Approved InspirED branding and copy, black-and-gold glass panels, persistent light/dark toggle and large mobile-readable text. Previous, Flag and Next quiz controls stay on one row.

Includes the original 100-set homophones PDF and searchable cards, four labelled model notes, two sample quizzes and 58 existing video catalogue entries. Mock Test 7 has 100 practice items: 86 unchanged and 14 clearly labelled syllabus-topic adaptations. Original wording, options, keys and explanations remain in Admin review. These are not represented as verified PYQs.

Students can take tests, review explanations, flag/resume, save resources and track progress. Premium route: https://play.google.com/store/apps/details?id=com.zkbqjd.abzoxj

## Hosting and identity

The application uses a Vinext Worker and Sites D1 storage. Tested deployment: https://inspired-learning-portal.faceacademy01.chatgpt.site. GitHub stores the source; the server-side identity and progress handlers require the Sites runtime.

Free resources work anonymously. Optional Sign in with ChatGPT saves account progress. The only account roles are Admin and Student. Server-controlled PORTAL_ADMIN_EMAIL selects the owner. APIs use the trusted Site-scoped identity, validate writes and recompute scores. Guest and account caches are separate. Admin practice is excluded from student analytics.

Runtime secret values, learner records and checkout-local settings are excluded. Configure PORTAL_ADMIN_EMAIL through Sites runtime settings. The hosting manifest retains the existing Site identity and DB binding.

## Source and validation

Learning UI and content are in portal/. scripts/prepare-portal.mjs creates the shell, assets, client bundle and scoring catalogue. Request handlers are in app/api/, progress validation in lib/progress-service.mjs, and the generated D1 migration in drizzle/.

With Node 22.13 or newer:

```sh
node scripts/prepare-portal.mjs
node tests/progress-service.test.mjs
```

Production deployments use the Sites source and build workflow. The same source passed the production Worker build, database/permission/scoring checks, anonymous learning checks, account sync simulations and Chrome mobile checks at 320 and 360 pixels. A physical two-device session remains to be checked.

## Release status

The portal is live with HTTPS at https://inspiredinstitute.in/. Its source replaces the earlier static website. Sites runs the application and database; GitHub retains the source. Both inspiredinstitute.in and www.inspiredinstitute.in are active with HTTPS and have been checked in the browser. Read MIGRATION.md for the activation checkpoint and backup. Original source is preserved at backup/before-learning-portal-2026-10-18.

The legacy /index.html route redirects to the homepage. A retirement worker at /sw.js clears only the previous site's public-shell caches and unregisters itself; learner storage and unrelated caches are preserved.
