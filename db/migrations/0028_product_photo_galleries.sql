-- Independent product-page photos. Product cards remain products.image_url.
-- Removing an association never deletes historical order image snapshots.
CREATE TABLE IF NOT EXISTS product_photo_galleries (
 product_id TEXT PRIMARY KEY REFERENCES products(id),
 photos_json TEXT NOT NULL CHECK(json_valid(photos_json) AND json_type(photos_json)='array'),
 revision INTEGER NOT NULL CHECK(revision>0),
 change_token TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
