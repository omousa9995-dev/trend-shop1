-- Apply once to the existing database; fresh databases use schema.sql.
ALTER TABLE products ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';
