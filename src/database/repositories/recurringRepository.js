const COLUMNS = `r.id, r.title, r.amount_paise, r.category_id, r.frequency, r.start_date, r.end_date,
       r.is_active, r.notes, c.name AS category_name, c.icon AS category_icon`;

export async function insertRecurring(db, r) {
  await db.runAsync(
    `INSERT INTO recurring_expenses
       (id, title, amount_paise, category_id, frequency, start_date, end_date, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [r.id, r.title, r.amountPaise, r.categoryId, r.frequency, r.startDate, r.endDate ?? null, r.notes ?? null, r.nowIso, r.nowIso],
  );
}

export async function getRecurringById(db, id) {
  return db.getFirstAsync(
    `SELECT ${COLUMNS}
     FROM recurring_expenses r JOIN expense_categories c ON c.id = r.category_id
     WHERE r.id = ?`,
    [id],
  );
}

export async function listRecurringRows(db, { activeOnly = false } = {}) {
  return db.getAllAsync(
    `SELECT ${COLUMNS}
     FROM recurring_expenses r JOIN expense_categories c ON c.id = r.category_id
     ${activeOnly ? 'WHERE r.is_active = 1' : ''}
     ORDER BY r.is_active DESC, r.title COLLATE NOCASE, r.created_at`,
  );
}

// Frequency and start date are fixed once created: the occurrence history is keyed to them.
export async function updateRecurringRow(db, r) {
  const result = await db.runAsync(
    `UPDATE recurring_expenses
     SET title = ?, amount_paise = ?, category_id = ?, end_date = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [r.title, r.amountPaise, r.categoryId, r.endDate ?? null, r.notes ?? null, r.nowIso, r.id],
  );
  return result.changes;
}

export async function setRecurringActiveRow(db, id, isActive, nowIso) {
  const result = await db.runAsync('UPDATE recurring_expenses SET is_active = ?, updated_at = ? WHERE id = ?', [
    isActive ? 1 : 0,
    nowIso,
    id,
  ]);
  return result.changes;
}

export async function deleteRecurringRow(db, id) {
  const result = await db.runAsync('DELETE FROM recurring_expenses WHERE id = ?', [id]);
  return result.changes;
}

export async function listOccurrenceDates(db, recurringId) {
  const rows = await db.getAllAsync('SELECT due_date FROM recurring_expense_occurrences WHERE recurring_id = ?', [recurringId]);
  return rows.map((r) => r.due_date);
}

export async function insertOccurrence(db, o) {
  await db.runAsync(
    `INSERT INTO recurring_expense_occurrences (id, recurring_id, due_date, status, transaction_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [o.id, o.recurringId, o.dueDate, o.status, o.transactionId ?? null, o.nowIso],
  );
}
