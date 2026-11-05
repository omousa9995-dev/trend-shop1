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
 locale TEXT NOT NULL DEFAULT 'ar' CHECK(locale IN ('ar','en')),
 name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT,governorate TEXT NOT NULL,address TEXT NOT NULL,maps_url TEXT NOT NULL DEFAULT '',notes TEXT,
 payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','cliq')),cliq_alias TEXT,
 status TEXT NOT NULL DEFAULT 'جديد' CHECK(status IN ('جديد','قيد التجهيز','تم')),
 subtotal_fils INTEGER NOT NULL CHECK(subtotal_fils>=0),
 discount_fils INTEGER NOT NULL DEFAULT 0 CHECK(discount_fils>=0),
 promotion_snapshot TEXT NOT NULL DEFAULT '[]',
 presentation_json TEXT NOT NULL DEFAULT '[]',
 shipping_fee_fils INTEGER CHECK(shipping_fee_fils IS NULL OR shipping_fee_fils>=0),
 notification_status TEXT NOT NULL DEFAULT 'غير مفعّل',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE TABLE IF NOT EXISTS order_items (
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL REFERENCES products(id),
 name_snapshot TEXT NOT NULL,image_snapshot TEXT,qty INTEGER NOT NULL CHECK(qty BETWEEN 1 AND 10),
 unit_price_fils INTEGER NOT NULL CHECK(unit_price_fils>=0),
 options_snapshot TEXT NOT NULL DEFAULT '[]',
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

CREATE TABLE IF NOT EXISTS promotions (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('offer','combo')),
 title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',config_json TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active);

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
