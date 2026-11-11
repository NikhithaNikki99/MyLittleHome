// Recurring expenses and subscriptions. A recurring expense is a schedule; each charge it creates is a normal
// row in `transactions`, so History, Breakdown, budgets and Home need no special handling.
//
// recurring_expense_occurrences remembers every due date already handled (posted or skipped) so a charge is never
// created twice, and never comes back after the user deletes it from History. Deleting a schedule removes its
// occurrences but keeps the transactions it created. Deleting a transaction keeps the occurrence (transaction_id
// becomes NULL) for the same reason.
export default {
  version: 10,
  name: 'recurring_expenses',
  sql: `
    CREATE TABLE recurring_expenses (
      id           TEXT PRIMARY KEY NOT NULL,
      title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      category_id  TEXT NOT NULL REFERENCES expense_categories (id) ON DELETE RESTRICT,
      frequency    TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
      start_date   TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      end_date     TEXT CHECK (end_date IS NULL OR (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND end_date >= start_date)),
      is_active    INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      notes        TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX idx_recurring_expenses_active ON recurring_expenses (is_active);
    CREATE INDEX idx_recurring_expenses_category ON recurring_expenses (category_id);

    CREATE TABLE recurring_expense_occurrences (
      id             TEXT PRIMARY KEY NOT NULL,
      recurring_id   TEXT NOT NULL REFERENCES recurring_expenses (id) ON DELETE CASCADE,
      due_date       TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      status         TEXT NOT NULL CHECK (status IN ('posted', 'skipped')),
      transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
      created_at     TEXT NOT NULL,
      UNIQUE (recurring_id, due_date)
    );
    CREATE INDEX idx_recurring_occurrences_transaction ON recurring_expense_occurrences (transaction_id);
  `,
};
