-- Assistant configuration and aggregate counters only. Never store faces or conversations.
CREATE TABLE IF NOT EXISTS care_assistant_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 1,
 config_json TEXT NOT NULL DEFAULT '{}', encrypted_key TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
INSERT OR IGNORE INTO care_assistant_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS care_assistant_usage (
 day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0,
 successes INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0,
 images INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0,
 output_tokens INTEGER NOT NULL DEFAULT 0
);
