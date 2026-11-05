-- Additive media metadata only. No seeded videos, order or inventory changes.
CREATE TABLE IF NOT EXISTS product_videos (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL REFERENCES products(id),
 media_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL CHECK(mime IN ('video/mp4','video/quicktime','video/webm')),
 size INTEGER NOT NULL CHECK(size BETWEEN 24 AND 20971520),
 title TEXT NOT NULL DEFAULT '', title_en TEXT NOT NULL DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS product_videos_product ON product_videos(product_id,active);
CREATE TRIGGER IF NOT EXISTS product_videos_cap BEFORE INSERT ON product_videos
WHEN (SELECT count(*) FROM product_videos WHERE product_id=NEW.product_id)>=3
BEGIN SELECT RAISE(ABORT,'product video limit'); END;
