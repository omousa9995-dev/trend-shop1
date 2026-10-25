-- Trend Shop - Cloudflare D1 (SQLite). All monetary amounts are integer fils, never floats.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, brand TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL,
 subcategory TEXT DEFAULT '', description TEXT NOT NULL DEFAULT '',
 details_json TEXT NOT NULL DEFAULT '{}',
 reference_price_fils INTEGER NOT NULL CHECK(reference_price_fils>=0),
 price_fils INTEGER NOT NULL CHECK(price_fils>=0), discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 90),
 image_url TEXT NOT NULL DEFAULT '/images/TS0001.svg', source_url TEXT, source_shop TEXT,
 approved INTEGER NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category,active);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,governorate TEXT NOT NULL,address TEXT NOT NULL,notes TEXT,
 payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','cliq')),cliq_alias TEXT,
 status TEXT NOT NULL DEFAULT 'جديد' CHECK(status IN ('جديد','قيد التجهيز','تم')),
 subtotal_fils INTEGER NOT NULL CHECK(subtotal_fils>=0),
 notification_status TEXT NOT NULL DEFAULT 'غير مفعّل',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 name_snapshot TEXT NOT NULL,image_snapshot TEXT,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 10),
 unit_price_fils INTEGER NOT NULL CHECK(unit_price_fils>=0),
 PRIMARY KEY(order_id,product_id)
);
CREATE TRIGGER IF NOT EXISTS enforce_stock_before_order_item BEFORE INSERT ON order_items
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM products WHERE id=NEW.product_id AND active=1 AND approved=1 AND stock>=NEW.qty
 ) THEN RAISE(ABORT,'OUT_OF_STOCK_OR_UNAPPROVED') END;
 SELECT CASE WHEN NEW.unit_price_fils != (SELECT price_fils FROM products WHERE id=NEW.product_id)
 THEN RAISE(ABORT,'PRICE_CHANGED') END;
END;
CREATE TRIGGER IF NOT EXISTS debit_stock_after_order_item AFTER INSERT ON order_items
BEGIN
 UPDATE products SET stock=stock-NEW.qty,updated_at=datetime('now') WHERE id=NEW.product_id;
END;
CREATE TABLE IF NOT EXISTS throttle (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
-- A singleton is claimed once using a private bootstrap token. Passwords are salted hashes.
CREATE TABLE IF NOT EXISTS admin_credentials (
 id INTEGER PRIMARY KEY CHECK(id=1),
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
