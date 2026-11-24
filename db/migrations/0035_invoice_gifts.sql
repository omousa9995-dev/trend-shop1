CREATE TABLE IF NOT EXISTS invoice_gifts (
  source_order_id TEXT PRIMARY KEY NOT NULL REFERENCES orders(id),
  scan_token TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  wallet_hash TEXT,
  claimed_at INTEGER,
  CHECK ((wallet_hash IS NULL) = (claimed_at IS NULL))
);
CREATE INDEX IF NOT EXISTS invoice_gifts_wallet ON invoice_gifts(wallet_hash, claimed_at);
CREATE TABLE IF NOT EXISTS invoice_gift_redemptions (
  source_order_id TEXT PRIMARY KEY NOT NULL REFERENCES invoice_gifts(source_order_id),
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  discount_fils INTEGER NOT NULL CHECK (discount_fils > 0)
);
CREATE TRIGGER IF NOT EXISTS issue_invoice_gift AFTER INSERT ON orders
BEGIN
  INSERT INTO invoice_gifts(source_order_id) VALUES (NEW.id);
END;
INSERT INTO invoice_gifts(source_order_id)
  SELECT id FROM orders WHERE id NOT IN (SELECT source_order_id FROM invoice_gifts);
