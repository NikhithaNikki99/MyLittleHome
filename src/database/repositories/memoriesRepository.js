// Read-only queries for Memories. Dates are local 'YYYY-MM-DD' text, so ranges are half-open
// [start, endExclusive) and compare as plain strings.

export async function listTimelineEntries(db, limit = 200) {
  return db.getAllAsync(
    `SELECT id, title, content, entry_date, entry_time, mood, is_favorite
     FROM diary_entries
     ORDER BY entry_date DESC, entry_time DESC, created_at DESC
     LIMIT ?`,
    [limit],
  );
}

// Photos for the given entries, in display order. Chunked to stay well under SQLite's variable limit.
export async function listPhotosForEntries(db, entryIds) {
  const rows = [];
  for (let i = 0; i < entryIds.length; i += 200) {
    const chunk = entryIds.slice(i, i + 200);
    const marks = chunk.map(() => '?').join(', ');
    const part = await db.getAllAsync(
      `SELECT id, entry_id, uri, sort_order FROM diary_photos
       WHERE entry_id IN (${marks}) ORDER BY entry_id, sort_order, created_at`,
      chunk,
    );
    rows.push(...part);
  }
  return rows;
}

// Entries written on this calendar day (month and day) in an earlier year.
export async function listOnThisDay(db, dateKey) {
  return db.getAllAsync(
    `SELECT id, title, content, entry_date, mood
     FROM diary_entries
     WHERE substr(entry_date, 6, 5) = ? AND substr(entry_date, 1, 4) < ?
     ORDER BY entry_date DESC, entry_time DESC`,
    [dateKey.slice(5), dateKey.slice(0, 4)],
  );
}

export async function countEntriesInRange(db, start, endExclusive) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM diary_entries WHERE entry_date >= ? AND entry_date < ?',
    [start, endExclusive],
  );
  return row.n;
}

export async function moodDistributionInRange(db, start, endExclusive) {
  return db.getAllAsync(
    `SELECT mood, COUNT(*) AS n FROM mood_logs
     WHERE log_date >= ? AND log_date < ? GROUP BY mood ORDER BY mood`,
    [start, endExclusive],
  );
}

export async function expenseTotalInRange(db, start, endExclusive) {
  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount_paise), 0) AS total, COUNT(*) AS n FROM transactions
     WHERE kind = 'expense' AND txn_date >= ? AND txn_date < ?`,
    [start, endExclusive],
  );
  return { totalPaise: row.total, count: row.n };
}

// A habit counts as done on a day when its logged count reached its target.
export async function habitCompletionsInRange(db, start, endExclusive) {
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS n FROM habit_logs l JOIN habits h ON h.id = l.habit_id
     WHERE l.log_date >= ? AND l.log_date < ? AND l.count >= h.target_count`,
    [start, endExclusive],
  );
  return row.n;
}

export async function waterSummaryInRange(db, start, endExclusive) {
  const row = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount_ml), 0) AS total, COUNT(DISTINCT log_date) AS days
     FROM water_logs WHERE log_date >= ? AND log_date < ?`,
    [start, endExclusive],
  );
  return { totalMl: row.total, days: row.days };
}

// First and last weigh-in inside the range (latest of a day is the one entered last).
export async function weightBoundsInRange(db, start, endExclusive) {
  const first = await db.getFirstAsync(
    `SELECT weight_kg, entry_date FROM weight_entries
     WHERE entry_date >= ? AND entry_date < ?
     ORDER BY entry_date ASC, created_at ASC LIMIT 1`,
    [start, endExclusive],
  );
  const last = await db.getFirstAsync(
    `SELECT weight_kg, entry_date FROM weight_entries
     WHERE entry_date >= ? AND entry_date < ?
     ORDER BY entry_date DESC, created_at DESC LIMIT 1`,
    [start, endExclusive],
  );
  return { first, last };
}

// "My Little Moments": a favourite entry from the month if there is one, else the newest entry.
export async function pickMomentEntry(db, start, endExclusive) {
  return db.getFirstAsync(
    `SELECT id, title, content, entry_date, mood, is_favorite FROM diary_entries
     WHERE entry_date >= ? AND entry_date < ?
     ORDER BY is_favorite DESC, entry_date DESC, entry_time DESC LIMIT 1`,
    [start, endExclusive],
  );
}
