-- Additive presentation fields. Only TS0081 uses the pilot ordering and covers.
ALTER TABLE product_videos ADD COLUMN poster_url TEXT NOT NULL DEFAULT '';
ALTER TABLE product_videos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
