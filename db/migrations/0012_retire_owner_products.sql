-- Owner-requested catalog removal, 2026-11-01. Safe to repeat.
-- Deactivate first so an in-flight checkout fails its stock/approval trigger.
UPDATE products SET active=0,approved=0,updated_at=datetime('now')
WHERE id IN ('TS0023','TS0024','TS0050','TS0051','TS0052','TS0053','TS0055','TS0127','TS0156','TS0157','TS0185','TS0186','TS0232') AND (active<>0 OR approved<>0);
-- Preserve an already-purchased record if a customer order arrived before removal.
-- The application retirement policy blocks these IDs in every public catalog and order.
DELETE FROM products WHERE id IN ('TS0023','TS0024','TS0050','TS0051','TS0052','TS0053','TS0055','TS0127','TS0156','TS0157','TS0185','TS0186','TS0232')
AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_items.product_id=products.id);
