// Entry dates and titles for the month, oldest first. Only these two columns are read: the report lists
// what was written, not the diary text itself.
export async function listEntryRowsForMonth(db, start, endExclusive, limit) {
  return db.getAllAsync(
    `SELECT entry_date, title FROM diary_entries
     WHERE entry_date >= ? AND entry_date < ? ORDER BY entry_date, entry_time LIMIT ?`,
    [start, endExclusive, limit],
  );
}
