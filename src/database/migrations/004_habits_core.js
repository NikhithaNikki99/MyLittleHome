// Schedule: a habit repeats on the weekdays listed in habit_schedule_days (0 = Sunday ... 6 = Saturday).
// A habit with no schedule rows is not due on any day, so the app always writes at least one.
// Completions: one habit_logs row per habit per local date (count tracks progress toward target_count).
// Archiving (not deleting) keeps history; deleting a habit cascades to its schedule and logs.
export default {
  version: 4,
  name: 'habits_core',
  sql: `
    CREATE TABLE habits (
      id           TEXT PRIMARY KEY NOT NULL,
      name         TEXT NOT NULL CHECK (length(trim(name)) > 0),
      icon         TEXT NOT NULL DEFAULT 'sprout',
      color        TEXT NOT NULL DEFAULT 'accentSage',
      target_count INTEGER NOT NULL DEFAULT 1 CHECK (target_count >= 1 AND target_count <= 100),
      start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      archived     INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE habit_schedule_days (
      habit_id TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
      weekday  INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
      PRIMARY KEY (habit_id, weekday)
    );

    CREATE TABLE habit_logs (
      id         TEXT PRIMARY KEY NOT NULL,
      habit_id   TEXT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
      log_date   TEXT NOT NULL CHECK (log_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      count      INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (habit_id, log_date)
    );
    CREATE INDEX idx_habit_logs_date ON habit_logs (log_date);
  `,
};
