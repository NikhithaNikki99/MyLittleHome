// One sleep row per local date (the date you woke up).
export async function upsertSleep(db, { id, logDate, minutes, quality, note, nowIso }) {
  await db.runAsync(
    `INSERT INTO sleep_logs (id, log_date, minutes, quality, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(log_date) DO UPDATE SET
       minutes = excluded.minutes, quality = excluded.quality, note = excluded.note,
       updated_at = excluded.updated_at`,
    [id, logDate, minutes, quality ?? null, note ?? null, nowIso, nowIso],
  );
}

export async function getSleepForDate(db, logDate) {
  return db.getFirstAsync('SELECT id, log_date, minutes, quality, note FROM sleep_logs WHERE log_date = ?', [
    logDate,
  ]);
}

export async function getLatestSleep(db) {
  return db.getFirstAsync(
    'SELECT id, log_date, minutes, quality, note FROM sleep_logs ORDER BY log_date DESC LIMIT 1',
  );
}

export async function listSleepInRange(db, start, endExclusive) {
  return db.getAllAsync(
    `SELECT id, log_date, minutes, quality, note FROM sleep_logs
     WHERE log_date >= ? AND log_date < ? ORDER BY log_date`,
    [start, endExclusive],
  );
}

// Newest first.
export async function listRecentSleep(db, limit) {
  return db.getAllAsync(
    'SELECT id, log_date, minutes, quality, note FROM sleep_logs ORDER BY log_date DESC LIMIT ?',
    [limit],
  );
}

export async function deleteSleepForDate(db, logDate) {
  await db.runAsync('DELETE FROM sleep_logs WHERE log_date = ?', [logDate]);
}
