-- Development migration, not applied to production.
CREATE TABLE IF NOT EXISTS community_groups (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL CHECK(platform IN ('whatsapp','telegram','website')),
 title TEXT NOT NULL,
 programme TEXT NOT NULL DEFAULT '',
 access_tier TEXT NOT NULL CHECK(access_tier IN ('free','premium_course','mock_only')),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_memberships (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 group_id INTEGER NOT NULL REFERENCES community_groups(id),
 learner_id TEXT NOT NULL,
 membership_status TEXT NOT NULL CHECK(membership_status IN ('pending','confirmed','left','review')),
 payment_status TEXT NOT NULL CHECK(payment_status IN ('free','paid_active','pending_verification','expired','refund_review','mock_only','manual_exception')),
 verified_at INTEGER,
 updated_at INTEGER NOT NULL,
 UNIQUE(group_id,learner_id)
);
CREATE INDEX IF NOT EXISTS idx_community_group ON community_memberships(group_id,membership_status);
CREATE INDEX IF NOT EXISTS idx_community_student ON community_memberships(learner_id);
