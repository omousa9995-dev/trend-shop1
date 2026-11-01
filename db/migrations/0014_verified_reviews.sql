CREATE TABLE IF NOT EXISTS reviews (
 id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),product_id TEXT NOT NULL REFERENCES products(id),
 display_name TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL,
 locale TEXT NOT NULL CHECK(locale IN ('ar','en')),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','hidden')),
 consent_at TEXT NOT NULL,video_url TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT(datetime('now')),moderated_at TEXT,
 UNIQUE(order_id,product_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_public ON reviews(status,product_id,created_at);
CREATE TABLE IF NOT EXISTS review_media (
 id TEXT PRIMARY KEY,review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,media_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_review_media_review ON review_media(review_id);
