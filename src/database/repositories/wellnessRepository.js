// ---- Mood (one row per local date) ----
export async function getMoodForDate(db, logDate) {
  return db.getFirstAsync('SELECT id, log_date, mood, note FROM mood_logs WHERE log_date = ?', [logDate]);
}

export async function upsertMood(db, { id, logDate, mood, note, nowIso }) {
  await db.runAsync(
    `INSERT INTO mood_logs (id, log_date, mood, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(log_date) DO UPDATE SET
       mood = excluded.mood, note = excluded.note, updated_at = excluded.updated_at`,
    [id, logDate, mood, note ?? null, nowIso, nowIso],
  );
}

// ---- Water (many logs per day) ----
export async function insertWaterLog(db, { id, logDate, amountMl, nowIso }) {
  await db.runAsync(
    'INSERT INTO water_logs (id, log_date, amount_ml, logged_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, logDate, amountMl, nowIso, nowIso],
  );
}

export async function getWaterTotalForDate(db, logDate) {
  const row = await db.getFirstAsync(
    'SELECT COALESCE(SUM(amount_ml), 0) AS total FROM water_logs WHERE log_date = ?',
    [logDate],
  );
  return row.total;
}

// ---- Weight ----
export async function insertWeightEntry(db, { id, entryDate, weightKg, note, nowIso }) {
  await db.runAsync(
    `INSERT INTO weight_entries (id, entry_date, weight_kg, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entryDate, weightKg, note ?? null, nowIso, nowIso],
  );
}

export async function getLatestWeightEntry(db) {
  return db.getFirstAsync(
    `SELECT id, entry_date, weight_kg, note FROM weight_entries
     ORDER BY entry_date DESC, created_at DESC LIMIT 1`,
  );
}

// The entry immediately before `entry` in time order, for a gentle "since last time" comparison.
export async function getPreviousWeightEntry(db, entry) {
  return db.getFirstAsync(
    `SELECT id, entry_date, weight_kg FROM weight_entries
     WHERE id != ? AND (entry_date < ? OR (entry_date = ? AND created_at < (SELECT created_at FROM weight_entries WHERE id = ?)))
     ORDER BY entry_date DESC, created_at DESC LIMIT 1`,
    [entry.id, entry.entry_date, entry.entry_date, entry.id],
  );
}

// ---- Mood ranges ----
export async function listMoodsInRange(db, start, endExclusive) {
  return db.getAllAsync(
    'SELECT log_date, mood FROM mood_logs WHERE log_date >= ? AND log_date < ? ORDER BY log_date',
    [start, endExclusive],
  );
}

// ---- Water: per-log access and per-day totals ----
export async function listWaterLogsForDate(db, logDate) {
  return db.getAllAsync(
    'SELECT id, amount_ml, logged_at FROM water_logs WHERE log_date = ? ORDER BY logged_at DESC, rowid DESC',
    [logDate],
  );
}

export async function getWaterLogById(db, id) {
  return db.getFirstAsync('SELECT id, log_date, amount_ml FROM water_logs WHERE id = ?', [id]);
}

export async function deleteWaterLog(db, id) {
  await db.runAsync('DELETE FROM water_logs WHERE id = ?', [id]);
}

export async function listWaterTotalsInRange(db, start, endExclusive) {
  return db.getAllAsync(
    `SELECT log_date, SUM(amount_ml) AS total FROM water_logs
     WHERE log_date >= ? AND log_date < ? GROUP BY log_date ORDER BY log_date`,
    [start, endExclusive],
  );
}

// ---- Weight: list, first, edit, delete ----
// Newest first, using the same ordering as getLatestWeightEntry.
export async function listWeightEntries(db, limit) {
  return db.getAllAsync(
    `SELECT id, entry_date, weight_kg, note FROM weight_entries
     ORDER BY entry_date DESC, created_at DESC LIMIT ?`,
    [limit],
  );
}

export async function getFirstWeightEntry(db) {
  return db.getFirstAsync(
    `SELECT id, entry_date, weight_kg FROM weight_entries
     ORDER BY entry_date ASC, created_at ASC LIMIT 1`,
  );
}

export async function getWeightEntryById(db, id) {
  return db.getFirstAsync('SELECT id, entry_date, weight_kg, note FROM weight_entries WHERE id = ?', [id]);
}

export async function updateWeightEntry(db, { id, entryDate, weightKg, note, nowIso }) {
  await db.runAsync(
    'UPDATE weight_entries SET entry_date = ?, weight_kg = ?, note = ?, updated_at = ? WHERE id = ?',
    [entryDate, weightKg, note ?? null, nowIso, id],
  );
}

export async function deleteWeightEntry(db, id) {
  await db.runAsync('DELETE FROM weight_entries WHERE id = ?', [id]);
}

// ---- Optional goal stored as a setting (cleared when the user removes the goal) ----
export async function deleteSettingKey(db, key) {
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', [key]);
}
