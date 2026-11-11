// Amounts are integer paise. Categories are referenced with ON DELETE RESTRICT so a category
// that still has transactions can never be deleted out from under them (archive it instead).
// The nine default categories are seeded here with fixed ids so they are stable across installs.
export default {
  version: 3,
  name: 'expenses_core',
  sql: `
    CREATE TABLE expense_categories (
      id         TEXT PRIMARY KEY NOT NULL,
      name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
      icon       TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      archived   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE transactions (
      id          TEXT PRIMARY KEY NOT NULL,
      kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
      title       TEXT NOT NULL CHECK (length(trim(title)) > 0),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      category_id TEXT NOT NULL REFERENCES expense_categories (id) ON DELETE RESTRICT,
      txn_date    TEXT NOT NULL CHECK (txn_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      notes       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX idx_transactions_date ON transactions (txn_date DESC, created_at DESC);
    CREATE INDEX idx_transactions_category ON transactions (category_id, txn_date);

    INSERT INTO expense_categories (id, name, icon, is_default, sort_order, created_at) VALUES
      ('cat-food',          'Food',          'utensils',      1, 1, '2026-01-01T00:00:00.000Z'),
      ('cat-travel',        'Travel',        'plane',         1, 2, '2026-01-01T00:00:00.000Z'),
      ('cat-shopping',      'Shopping',      'shopping-bag',  1, 3, '2026-01-01T00:00:00.000Z'),
      ('cat-bills',         'Bills',         'receipt',       1, 4, '2026-01-01T00:00:00.000Z'),
      ('cat-health',        'Health',        'heart-pulse',   1, 5, '2026-01-01T00:00:00.000Z'),
      ('cat-entertainment', 'Entertainment', 'clapperboard',  1, 6, '2026-01-01T00:00:00.000Z'),
      ('cat-education',     'Education',     'graduation-cap',1, 7, '2026-01-01T00:00:00.000Z'),
      ('cat-personal-care', 'Personal Care', 'sparkles',      1, 8, '2026-01-01T00:00:00.000Z'),
      ('cat-other',         'Other',         'ellipsis',      1, 9, '2026-01-01T00:00:00.000Z');
  `,
};
