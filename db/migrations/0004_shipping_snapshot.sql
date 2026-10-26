-- Apply ONCE to an existing database that lacks this column. Fresh schema includes it.
-- NULL keeps pre-promotion orders and manually quoted delivery unchanged.
ALTER TABLE orders ADD COLUMN shipping_fee_fils INTEGER
 CHECK(shipping_fee_fils IS NULL OR shipping_fee_fils>=0);
