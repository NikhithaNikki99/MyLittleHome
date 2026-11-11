// Diary. Dates are local 'YYYY-MM-DD' text; entry_time is local 'HH:MM'. Photos live in the app's
// private files directory: `uri` is the stored file path, and a missing file is handled at read time.
// Deleting an entry cascades to its photo rows and tag links (the app deletes the files first).
// Tags are shared, case-insensitively unique labels; the four from the design are seeded.
export default {
  version: 6,
  name: 'diary',
  sql: `
    CREATE TABLE diary_entries (
      id          TEXT PRIMARY KEY NOT NULL,
      title       TEXT,
      content     TEXT NOT NULL DEFAULT '',
      entry_date  TEXT NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      entry_time  TEXT NOT NULL DEFAULT '00:00'
                  CHECK (entry_time GLOB '[0-2][0-9]:[0-5][0-9]' AND CAST(substr(entry_time, 1, 2) AS INTEGER) <= 23),
      mood        INTEGER CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
      is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      CHECK (length(trim(COALESCE(title, ''))) > 0 OR length(trim(content)) > 0)
    );
    CREATE INDEX idx_diary_entries_date ON diary_entries (entry_date DESC, entry_time DESC);
    CREATE INDEX idx_diary_entries_favorite ON diary_entries (is_favorite, entry_date DESC);

    CREATE TABLE diary_photos (
      id         TEXT PRIMARY KEY NOT NULL,
      entry_id   TEXT NOT NULL REFERENCES diary_entries (id) ON DELETE CASCADE,
      uri        TEXT NOT NULL,
      width      INTEGER,
      height     INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_diary_photos_entry ON diary_photos (entry_id, sort_order);

    CREATE TABLE diary_tags (
      id         TEXT PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
      created_at TEXT NOT NULL
    );

    CREATE TABLE entry_tags (
      entry_id TEXT NOT NULL REFERENCES diary_entries (id) ON DELETE CASCADE,
      tag_id   TEXT NOT NULL REFERENCES diary_tags (id) ON DELETE CASCADE,
      PRIMARY KEY (entry_id, tag_id)
    );
    CREATE INDEX idx_entry_tags_tag ON entry_tags (tag_id);

    INSERT INTO diary_tags (id, name, created_at) VALUES
      ('tag-life',      'Life',      '2026-01-01T00:00:00.000Z'),
      ('tag-work',      'Work',      '2026-01-01T00:00:00.000Z'),
      ('tag-health',    'Health',    '2026-01-01T00:00:00.000Z'),
      ('tag-gratitude', 'Gratitude', '2026-01-01T00:00:00.000Z');
  `,
};
