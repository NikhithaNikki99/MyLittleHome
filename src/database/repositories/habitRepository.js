export async function insertHabit(db, h) {
  await db.runAsync(
    `INSERT INTO habits (id, name, icon, color, target_count, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [h.id, h.name, h.icon, h.color, h.targetCount, h.startDate, h.nowIso, h.nowIso],
  );
  for (const weekday of h.weekdays) {
    await db.runAsync('INSERT INTO habit_schedule_days (habit_id, weekday) VALUES (?, ?)', [h.id, weekday]);
  }
}

// Active habits scheduled on `weekday` that had already started by `dateKey`,
// with that date's completion count (0 when not logged).
export async function listHabitsDueOn(db, dateKey, weekday) {
  return db.getAllAsync(
    `SELECT h.id, h.name, h.icon, h.color, h.target_count,
            COALESCE(l.count, 0) AS done_count
     FROM habits h
     JOIN habit_schedule_days s ON s.habit_id = h.id AND s.weekday = ?
     LEFT JOIN habit_logs l ON l.habit_id = h.id AND l.log_date = ?
     WHERE h.archived = 0 AND h.start_date <= ?
     ORDER BY h.created_at, h.name`,
    [weekday, dateKey, dateKey],
  );
}

export async function getHabitById(db, id) {
  return db.getFirstAsync('SELECT id, name, target_count, archived FROM habits WHERE id = ?', [id]);
}

export async function getHabitLog(db, habitId, logDate) {
  return db.getFirstAsync('SELECT id, count FROM habit_logs WHERE habit_id = ? AND log_date = ?', [
    habitId,
    logDate,
  ]);
}

export async function upsertHabitLog(db, { id, habitId, logDate, count, nowIso }) {
  await db.runAsync(
    `INSERT INTO habit_logs (id, habit_id, log_date, count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, log_date) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    [id, habitId, logDate, count, nowIso, nowIso],
  );
}

export async function deleteHabitLog(db, habitId, logDate) {
  await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ? AND log_date = ?', [habitId, logDate]);
}

// ---- Management: list, edit, archive, delete ----
export async function listAllHabits(db) {
  return db.getAllAsync(
    `SELECT id, name, icon, color, target_count, start_date, archived
     FROM habits ORDER BY archived, created_at, name`,
  );
}

export async function listScheduleDays(db) {
  return db.getAllAsync('SELECT habit_id, weekday FROM habit_schedule_days ORDER BY habit_id, weekday');
}

// One row per habit-day that reached its daily target (count >= target_count).
export async function listCompletedHabitDays(db) {
  return db.getAllAsync(
    `SELECT l.habit_id, l.log_date FROM habit_logs l
     JOIN habits h ON h.id = l.habit_id
     WHERE l.count >= h.target_count
     ORDER BY l.log_date`,
  );
}

export async function updateHabitRow(db, { id, name, icon, color, targetCount, nowIso }) {
  await db.runAsync(
    'UPDATE habits SET name = ?, icon = ?, color = ?, target_count = ?, updated_at = ? WHERE id = ?',
    [name, icon, color, targetCount, nowIso, id],
  );
}

export async function replaceScheduleDays(db, habitId, weekdays) {
  await db.runAsync('DELETE FROM habit_schedule_days WHERE habit_id = ?', [habitId]);
  for (const weekday of weekdays) {
    await db.runAsync('INSERT INTO habit_schedule_days (habit_id, weekday) VALUES (?, ?)', [habitId, weekday]);
  }
}

export async function setHabitArchivedFlag(db, id, archived, nowIso) {
  await db.runAsync('UPDATE habits SET archived = ?, updated_at = ? WHERE id = ?', [archived ? 1 : 0, nowIso, id]);
}

// Children are deleted explicitly so this never depends on the connection's foreign_keys setting.
export async function deleteHabitById(db, id) {
  await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', [id]);
  await db.runAsync('DELETE FROM habit_schedule_days WHERE habit_id = ?', [id]);
  await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
}
