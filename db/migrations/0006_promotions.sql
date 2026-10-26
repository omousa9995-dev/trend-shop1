-- Apply once to an existing 1.7 database. Fresh schema includes the columns.
ALTER TABLE orders ADD COLUMN discount_fils INTEGER NOT NULL DEFAULT 0 CHECK(discount_fils>=0);
ALTER TABLE orders ADD COLUMN promotion_snapshot TEXT NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS promotions (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('offer','combo')),
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',config_json TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);
