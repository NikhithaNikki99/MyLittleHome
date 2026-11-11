export async function insertHabit(db, h) {
  await db.runAsync(
    `INSERT INTO habits
       (id, name, icon, color, target_count, start_date, schedule_type, interval_days, weekly_target, month_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.id, h.name, h.icon, h.color, h.targetCount, h.startDate,
      h.scheduleType ?? 'weekdays', h.intervalDays ?? null, h.weeklyTarget ?? null, h.monthDay ?? null,
      h.nowIso, h.nowIso,
    ],
  );
  for (const weekday of h.weekdays) {
    await db.runAsync('INSERT INTO habit_schedule_days (habit_id, weekday) VALUES (?, ?)', [h.id, weekday]);
  }
}

// Active habits that had started by `dateKey`, with their schedule settings. Whether each is due that day is
// decided in habitSchedule.js, because flexible schedules depend on what was already done in their window.
export async function listActiveHabitsStartedBy(db, dateKey) {
  return db.getAllAsync(
    `SELECT id, name, icon, color, target_count, start_date, schedule_type, interval_days, weekly_target, month_day
     FROM habits
     WHERE archived = 0 AND start_date <= ?
     ORDER BY created_at, name`,
    [dateKey],
  );
}

// habit_id, log_date for every day that reached its daily target, limited to the given habits.
export async function listLogCountsOn(db, dateKey) {
  return db.getAllAsync('SELECT habit_id, count FROM habit_logs WHERE log_date = ?', [dateKey]);
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
    `SELECT id, name, icon, color, target_count, start_date, archived, schedule_type, interval_days, weekly_target, month_day
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

// The type and its settings are replaced together, so a habit never keeps settings from an older schedule.
export async function updateHabitRow(db, { id, name, icon, color, targetCount, scheduleType, intervalDays, weeklyTarget, monthDay, nowIso }) {
  await db.runAsync(
    `UPDATE habits
     SET name = ?, icon = ?, color = ?, target_count = ?, schedule_type = ?, interval_days = ?, weekly_target = ?, month_day = ?, updated_at = ?
     WHERE id = ?`,
    [name, icon, color, targetCount, scheduleType ?? 'weekdays', intervalDays ?? null, weeklyTarget ?? null, monthDay ?? null, nowIso, id],
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
