export async function getReflectionRow(db, monthKey) {
  return db.getFirstAsync(
    `SELECT id, month_key, went_well, was_hard, grateful_for, intention, created_at, updated_at
     FROM monthly_reflections WHERE month_key = ?`,
    [monthKey],
  );
}

// One reflection per month: writing again replaces the text and keeps the original id and created_at.
export async function upsertReflectionRow(db, r) {
  await db.runAsync(
    `INSERT INTO monthly_reflections
       (id, month_key, went_well, was_hard, grateful_for, intention, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(month_key) DO UPDATE SET
       went_well = excluded.went_well,
       was_hard = excluded.was_hard,
       grateful_for = excluded.grateful_for,
       intention = excluded.intention,
       updated_at = excluded.updated_at`,
    [r.id, r.monthKey, r.wentWell, r.wasHard, r.gratefulFor, r.intention, r.nowIso, r.nowIso],
  );
}

export async function deleteReflectionRow(db, monthKey) {
  const result = await db.runAsync('DELETE FROM monthly_reflections WHERE month_key = ?', [monthKey]);
  return result.changes;
}
