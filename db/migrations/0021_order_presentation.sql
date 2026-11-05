-- Keep the stock ledger and original order items intact. New receipts store
-- immutable customer-facing bundle images, options and final line totals.
ALTER TABLE orders ADD COLUMN presentation_json TEXT NOT NULL DEFAULT '[]';
