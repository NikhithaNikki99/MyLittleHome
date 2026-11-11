export async function listActiveCategories(db) {
  return db.getAllAsync(
    'SELECT id, name, icon FROM expense_categories WHERE archived = 0 ORDER BY sort_order, name',
  );
}

export async function getCategoryById(db, id) {
  return db.getFirstAsync('SELECT id, name, icon, archived FROM expense_categories WHERE id = ?', [id]);
}

export async function insertTransaction(db, t) {
  await db.runAsync(
    `INSERT INTO transactions
       (id, kind, title, amount_paise, category_id, txn_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.kind, t.title, t.amountPaise, t.categoryId, t.txnDate, t.notes ?? null, t.nowIso, t.nowIso],
  );
}

const TXN_COLUMNS = `t.id, t.kind, t.title, t.amount_paise, t.category_id, t.txn_date, t.notes,
       c.name AS category_name, c.icon AS category_icon`;

export async function getTransactionById(db, id) {
  return db.getFirstAsync(
    `SELECT ${TXN_COLUMNS}
     FROM transactions t JOIN expense_categories c ON c.id = t.category_id
     WHERE t.id = ?`,
    [id],
  );
}

export async function updateTransactionRow(db, t) {
  const result = await db.runAsync(
    `UPDATE transactions
     SET kind = ?, title = ?, amount_paise = ?, category_id = ?, txn_date = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [t.kind, t.title, t.amountPaise, t.categoryId, t.txnDate, t.notes ?? null, t.nowIso, t.id],
  );
  return result.changes;
}

export async function deleteTransactionRow(db, id) {
  const result = await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
  return result.changes;
}

// Most recent expenses first (by date, then by when they were logged).
export async function listRecentExpenses(db, limit) {
  return db.getAllAsync(
    `SELECT ${TXN_COLUMNS}
     FROM transactions t JOIN expense_categories c ON c.id = t.category_id
     WHERE t.kind = 'expense'
     ORDER BY t.txn_date DESC, t.created_at DESC
     LIMIT ?`,
    [limit],
  );
}

// Transactions in the half-open range [startDate, endExclusive), optionally narrowed by category and a
// text search over title/notes. LIKE wildcards in the search text are escaped so "50%" matches literally.
export async function listTransactionsInRange(db, startDate, endExclusive, { categoryId = null, search = '' } = {}) {
  const where = ['t.txn_date >= ?', 't.txn_date < ?'];
  const params = [startDate, endExclusive];
  if (categoryId) {
    where.push('t.category_id = ?');
    params.push(categoryId);
  }
  const needle = search.trim();
  if (needle) {
    const pattern = `%${needle.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push("(t.title LIKE ? ESCAPE '\\' OR COALESCE(t.notes, '') LIKE ? ESCAPE '\\')");
    params.push(pattern, pattern);
  }
  return db.getAllAsync(
    `SELECT ${TXN_COLUMNS}
     FROM transactions t JOIN expense_categories c ON c.id = t.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.txn_date DESC, t.created_at DESC`,
    params,
  );
}

export async function getExpenseTotalForDate(db, txnDate) {
  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total, COUNT(*) AS count
     FROM transactions WHERE kind = 'expense' AND txn_date = ?`,
    [txnDate],
  );
  return { totalPaise: row.total, count: row.count };
}

// Totals for the half-open date range [startDate, endExclusive), split by kind.
export async function getTotalsForRange(db, startDate, endExclusive) {
  const rows = await db.getAllAsync(
    `SELECT kind, COALESCE(SUM(amount_paise), 0) AS total, COUNT(*) AS count
     FROM transactions WHERE txn_date >= ? AND txn_date < ? GROUP BY kind`,
    [startDate, endExclusive],
  );
  const result = { expensePaise: 0, incomePaise: 0, expenseCount: 0 };
  for (const r of rows) {
    if (r.kind === 'expense') {
      result.expensePaise = r.total;
      result.expenseCount = r.count;
    } else {
      result.incomePaise = r.total;
    }
  }
  return result;
}

// Expense totals per category for a half-open range, largest first. Categories with no spend are omitted.
export async function getExpenseTotalsByCategory(db, startDate, endExclusive) {
  return db.getAllAsync(
    `SELECT t.category_id AS category_id, c.name AS category_name, c.icon AS category_icon,
            SUM(t.amount_paise) AS total, COUNT(*) AS count
     FROM transactions t JOIN expense_categories c ON c.id = t.category_id
     WHERE t.kind = 'expense' AND t.txn_date >= ? AND t.txn_date < ?
     GROUP BY t.category_id
     ORDER BY total DESC, c.sort_order, c.name`,
    [startDate, endExclusive],
  );
}
