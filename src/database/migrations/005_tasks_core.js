// Tasks with an optional due date. `completed_at` is set when done and cleared when un-done.
// priority: 1 = high, 2 = normal, 3 = low (so ascending sort puts important first).
export default {
  version: 5,
  name: 'tasks_core',
  sql: `
    CREATE TABLE tasks (
      id           TEXT PRIMARY KEY NOT NULL,
      title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
      description  TEXT,
      due_date     TEXT CHECK (due_date IS NULL OR due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      priority     INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
      completed_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX idx_tasks_due ON tasks (due_date, completed_at);
  `,
};
