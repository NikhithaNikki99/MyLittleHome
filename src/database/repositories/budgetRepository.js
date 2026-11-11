// Budgets for a 'YYYY-MM' month. category_id NULL is the overall budget; the two partial unique indexes in
// migration 007 allow at most one overall row and one row per category for each month.

export async function listBudgetsForMonth(db, month) {
  return db.getAllAsync(
    'SELECT id, month, category_id, limit_paise FROM budgets WHERE month = ? ORDER BY category_id IS NOT NULL, category_id',
    [month],
  );
}

// Upserts by (month, category) inside one transaction. The two cases use different WHERE clauses because
// `category_id = NULL` never matches in SQL.
export async function upsertBudget(db, { id, month, categoryId, limitPaise, nowIso }) {
  await db.withTransactionAsync(async () => {
    const existing =
      categoryId === null
        ? await db.getFirstAsync('SELECT id FROM budgets WHERE month = ? AND category_id IS NULL', [month])
        : await db.getFirstAsync('SELECT id FROM budgets WHERE month = ? AND category_id = ?', [month, categoryId]);
    if (existing) {
      await db.runAsync('UPDATE budgets SET limit_paise = ?, updated_at = ? WHERE id = ?', [
        limitPaise,
        nowIso,
        existing.id,
      ]);
    } else {
      await db.runAsync(
        `INSERT INTO budgets (id, month, category_id, limit_paise, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, month, categoryId, limitPaise, nowIso, nowIso],
      );
    }
  });
}

export async function deleteBudget(db, month, categoryId) {
  const result =
    categoryId === null
      ? await db.runAsync('DELETE FROM budgets WHERE month = ? AND category_id IS NULL', [month])
      : await db.runAsync('DELETE FROM budgets WHERE month = ? AND category_id = ?', [month, categoryId]);
  return result.changes;
}

// Copies every budget from one month into another. Rows that already exist in the target month are kept
// as they are, so the copy never overwrites limits the user set by hand. Returns how many rows were added.
export async function copyBudgets(db, fromMonth, toMonth, { newId, nowIso }) {
  let added = 0;
  await db.withTransactionAsync(async () => {
    const source = await db.getAllAsync('SELECT category_id, limit_paise FROM budgets WHERE month = ?', [fromMonth]);
    for (const row of source) {
      const exists =
        row.category_id === null
          ? await db.getFirstAsync('SELECT 1 AS found FROM budgets WHERE month = ? AND category_id IS NULL', [toMonth])
          : await db.getFirstAsync('SELECT 1 AS found FROM budgets WHERE month = ? AND category_id = ?', [
              toMonth,
              row.category_id,
            ]);
      if (exists) continue;
      await db.runAsync(
        `INSERT INTO budgets (id, month, category_id, limit_paise, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), toMonth, row.category_id, row.limit_paise, nowIso, nowIso],
      );
      added += 1;
    }
  });
  return added;
}
