-- Run once after checking PRAGMA table_info(order_items). Historical items retain [].
-- One row per product keeps existing stock triggers; choices are a frozen breakdown of its quantity.
ALTER TABLE order_items ADD COLUMN options_snapshot TEXT NOT NULL DEFAULT '[]';
