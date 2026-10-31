-- Add once to existing databases. Historical orders keep an empty optional link.
ALTER TABLE orders ADD COLUMN maps_url TEXT NOT NULL DEFAULT '';
