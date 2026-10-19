# Public social links — development only

Admin can save and order YouTube, WhatsApp, Telegram, Instagram, Facebook and Website destinations. Select **Publish this link publicly** only for a destination intended for everyone. Published eligible records appear in the footer; hidden drafts do not.

Social platform destinations must use a supported matching host. Every destination must use HTTPS without embedded credentials, nonstandard ports or local/IP addresses. Website is the option for other HTTPS domains. These checks do not establish ownership, trustworthiness of every page, or absence of redirects; Admin must verify the actual destination.

The public endpoint is `/api/social-links`. It exposes only label, platform and URL, ordered by Admin settings. Legacy rows are revalidated on reads. Disabled and invalid records are excluded, and the response is not cached. The footer hides itself on an empty or unavailable response. Links open separately with protected opener access and no referrer.

No real social URLs were seeded or published to the live site during development. Before release, review all existing enabled records for public intent, especially group invitations. Do not publish private paid-group invitation links. Publishing a social link does not grant enrolment, payment verification or external group membership.

There is no new database migration for this feature. Tests cover validation, hidden/invalid rows, public projection/order, markup safety, stale responses and the built local Worker publication/removal flow. Browser interaction, destination ownership review and social-link audit/versioning remain pending.
