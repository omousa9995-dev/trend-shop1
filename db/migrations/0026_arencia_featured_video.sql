-- Independent single upper video. Existing product_videos and their limits stay intact.
CREATE TABLE IF NOT EXISTS product_featured_videos (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL UNIQUE REFERENCES products(id),
 media_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL CHECK(mime IN ('video/mp4','video/quicktime','video/webm')),
 size INTEGER NOT NULL CHECK(size BETWEEN 24 AND 20971520),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
