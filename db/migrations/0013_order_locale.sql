-- Apply once after checking PRAGMA table_info(orders); historical orders stay Arabic.
ALTER TABLE orders ADD COLUMN locale TEXT NOT NULL DEFAULT 'ar' CHECK(locale IN ('ar','en'));
