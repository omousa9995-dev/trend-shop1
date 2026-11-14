-- No campaign, price, inventory or customer record is created by this migration.
CREATE TABLE IF NOT EXISTS limited_offers (
 slot INTEGER PRIMARY KEY CHECK(slot BETWEEN 1 AND 3),
 product_id TEXT NOT NULL UNIQUE REFERENCES products(id),
 price_fils INTEGER NOT NULL CHECK(price_fils BETWEEN 500 AND 20000 AND price_fils%10=0),
 starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL CHECK(ends_at>starts_at),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 request_id TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
-- Check the effective unit price again atomically when stock is debited.
-- An expired campaign cannot be charged using a stale discounted cart.
DROP TRIGGER IF EXISTS enforce_stock_before_order_item;
CREATE TRIGGER enforce_stock_before_order_item BEFORE INSERT ON order_items
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM products WHERE id=NEW.product_id AND active=1 AND approved=1 AND stock>=NEW.qty
 ) THEN RAISE(ABORT,'OUT_OF_STOCK_OR_UNAPPROVED') END;
 SELECT CASE WHEN NEW.unit_price_fils != (
  SELECT min(p.price_fils,coalesce((SELECT o.price_fils FROM limited_offers o
    WHERE o.product_id=p.id AND o.active=1 AND o.starts_at<=CAST(strftime('%s','now') AS INTEGER)
    AND o.ends_at>CAST(strftime('%s','now') AS INTEGER)),p.price_fils))
  FROM products p WHERE p.id=NEW.product_id
 ) THEN RAISE(ABORT,'PRICE_CHANGED') END;
END;
