-- Apply to the Sites D1 database in a controlled deployment only.
-- Never add unverified social URLs or private group member rosters to source control.
CREATE TABLE IF NOT EXISTS social_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 platform TEXT NOT NULL CHECK(platform IN ('youtube','whatsapp','telegram','instagram','facebook','website')),
 label TEXT NOT NULL,
 url TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 sort_order INTEGER NOT NULL DEFAULT 100,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_links_order ON social_links(sort_order,id);
