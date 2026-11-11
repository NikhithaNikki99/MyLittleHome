// Mood: one row per local calendar day (re-checking in the same day updates it).
// Water: many logs per day, summed for the daily total.
// Weight: many entries per day allowed; the latest by (entry_date, created_at) is "current".
export default {
  version: 2,
  name: 'wellness_core',
  sql: `
    CREATE TABLE mood_logs (
      id         TEXT PRIMARY KEY NOT NULL,
      log_date   TEXT NOT NULL UNIQUE CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      mood       INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
      note       TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE water_logs (
      id         TEXT PRIMARY KEY NOT NULL,
      log_date   TEXT NOT NULL CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      amount_ml  INTEGER NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
      logged_at  TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_water_logs_date ON water_logs (log_date);

    CREATE TABLE weight_entries (
      id         TEXT PRIMARY KEY NOT NULL,
      entry_date TEXT NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      weight_kg  REAL NOT NULL CHECK (weight_kg >= 20 AND weight_kg <= 300),
      note       TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX idx_weight_entries_date ON weight_entries (entry_date DESC, created_at DESC);
  `,
};
