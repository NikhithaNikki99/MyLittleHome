// Budgets: one overall budget per month (category_id NULL) plus optional per-category budgets.
// 'YYYY-MM' scoping lets each month carry its own limits. SQLite treats NULLs as distinct in UNIQUE,
// so overall-vs-category uniqueness is enforced with two partial unique indexes.
// Savings: goals with a target and optional deadline; contributions are append-only rows and the
// saved amount is always SUM(contributions) (never stored), so it cannot drift. Deleting a goal
// cascades to its contributions. Contributions are always positive; withdrawals are not modelled yet.
export default {
  version: 7,
  name: 'budgets_savings',
  sql: `
    CREATE TABLE budgets (
      id            TEXT PRIMARY KEY NOT NULL,
      month         TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
      category_id   TEXT REFERENCES expense_categories (id) ON DELETE CASCADE,
      limit_paise   INTEGER NOT NULL CHECK (limit_paise > 0),
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_budgets_overall ON budgets (month) WHERE category_id IS NULL;
    CREATE UNIQUE INDEX idx_budgets_category ON budgets (month, category_id) WHERE category_id IS NOT NULL;

    CREATE TABLE savings_goals (
      id            TEXT PRIMARY KEY NOT NULL,
      name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
      target_paise  INTEGER NOT NULL CHECK (target_paise > 0),
      deadline      TEXT CHECK (deadline IS NULL OR deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      archived      INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE savings_contributions (
      id            TEXT PRIMARY KEY NOT NULL,
      goal_id       TEXT NOT NULL REFERENCES savings_goals (id) ON DELETE CASCADE,
      amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
      contrib_date  TEXT NOT NULL CHECK (contrib_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      note          TEXT,
      created_at    TEXT NOT NULL
    );
    CREATE INDEX idx_savings_contributions_goal ON savings_contributions (goal_id, contrib_date DESC);
  `,
};
