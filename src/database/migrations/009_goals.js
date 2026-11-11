// Goals with optional milestones. A goal is complete when completed_at is set. Milestones cascade-delete
// with their goal. Progress is derived from milestones (done / total); a goal with none is done manually.
export default {
  version: 9,
  name: 'goals',
  sql: `
    CREATE TABLE goals (
      id           TEXT PRIMARY KEY NOT NULL,
      title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
      description  TEXT,
      target_date  TEXT CHECK (target_date IS NULL OR target_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      completed_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE goal_milestones (
      id           TEXT PRIMARY KEY NOT NULL,
      goal_id      TEXT NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
      title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
      sort_order   INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX idx_goal_milestones_goal ON goal_milestones (goal_id, sort_order);
  `,
};
