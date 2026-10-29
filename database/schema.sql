-- MediBot schema for Turso / libSQL (SQLite dialect). Optional: the app works without it.
-- Apply with:  turso db shell <db-name> < database/schema.sql   (or `npm run db:seed`, which also applies it)

CREATE TABLE IF NOT EXISTS dataset_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  version      TEXT    NOT NULL,
  record_count INTEGER NOT NULL,
  imported_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS healthcare_records (
  id                 TEXT PRIMARY KEY,
  question           TEXT NOT NULL,
  symptoms           TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  keywords           TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  category           TEXT NOT NULL,
  answer             TEXT NOT NULL,
  source             TEXT NOT NULL,
  source_url         TEXT,
  urgency            TEXT NOT NULL DEFAULT 'routine'
                     CHECK (urgency IN ('routine', 'monitor', 'see-doctor', 'emergency')),
  last_reviewed      TEXT,                          -- YYYY-MM-DD, NULL when never clinically reviewed
  review_status      TEXT NOT NULL DEFAULT 'sample-unreviewed'
                     CHECK (review_status IN ('sample-unreviewed', 'reviewed')),
  dataset_version_id INTEGER REFERENCES dataset_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_records_category ON healthcare_records(category);

-- Anonymous feedback. Stores NO message text and no user identifiers.
CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT    NOT NULL,
  record_id  TEXT,
  helpful    INTEGER NOT NULL CHECK (helpful IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Optional conversation metadata (counts only, never message content). Unused by default;
-- chats stay on the user's device unless you add server-side history and delete controls.
CREATE TABLE IF NOT EXISTS conversation_meta (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  message_count INTEGER NOT NULL DEFAULT 0
);
