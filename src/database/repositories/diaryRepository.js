const placeholders = (items) => items.map(() => '?').join(', ');

export async function insertEntryRow(db, e) {
  await db.runAsync(
    `INSERT INTO diary_entries (id, title, content, entry_date, entry_time, mood, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.title, e.content, e.entryDate, e.entryTime, e.mood, e.isFavorite ? 1 : 0, e.nowIso, e.nowIso],
  );
}

export async function updateEntryRow(db, e) {
  await db.runAsync(
    `UPDATE diary_entries
        SET title = ?, content = ?, entry_date = ?, entry_time = ?, mood = ?, is_favorite = ?, updated_at = ?
      WHERE id = ?`,
    [e.title, e.content, e.entryDate, e.entryTime, e.mood, e.isFavorite ? 1 : 0, e.nowIso, e.id],
  );
}

export async function setEntryFavorite(db, id, isFavorite, nowIso) {
  const r = await db.runAsync('UPDATE diary_entries SET is_favorite = ?, updated_at = ? WHERE id = ?', [
    isFavorite ? 1 : 0,
    nowIso,
    id,
  ]);
  return r.changes;
}

// Photo rows and tag links go with the entry (ON DELETE CASCADE).
export async function deleteEntryRow(db, id) {
  await db.runAsync('DELETE FROM diary_entries WHERE id = ?', [id]);
}

export async function getEntryRow(db, id) {
  return db.getFirstAsync(
    `SELECT id, title, content, entry_date, entry_time, mood, is_favorite, created_at, updated_at
       FROM diary_entries WHERE id = ?`,
    [id],
  );
}

// Filters combine with AND. `query` must already be trimmed; it matches title or content,
// case-insensitively, with LIKE wildcards in the term treated literally.
export async function listEntryRows(db, { date = null, likePattern = null, favoritesOnly = false, limit }) {
  const where = [];
  const params = [];
  if (date) {
    where.push('entry_date = ?');
    params.push(date);
  }
  if (likePattern) {
    where.push("(COALESCE(title, '') LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')");
    params.push(likePattern, likePattern);
  }
  if (favoritesOnly) where.push('is_favorite = 1');
  params.push(limit);
  return db.getAllAsync(
    `SELECT id, title, substr(content, 1, 300) AS snippet, entry_date, entry_time, mood, is_favorite
       FROM diary_entries
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY entry_date DESC, entry_time DESC, created_at DESC
      LIMIT ?`,
    params,
  );
}

// Days in [start, endExclusive) that have at least one entry.
export async function listEntryDates(db, start, endExclusive) {
  return db.getAllAsync(
    'SELECT DISTINCT entry_date FROM diary_entries WHERE entry_date >= ? AND entry_date < ? ORDER BY entry_date',
    [start, endExclusive],
  );
}

export async function listPhotos(db, entryId) {
  return db.getAllAsync(
    'SELECT id, uri, width, height, sort_order FROM diary_photos WHERE entry_id = ? ORDER BY sort_order, created_at',
    [entryId],
  );
}

export async function listPhotosForEntries(db, entryIds) {
  if (entryIds.length === 0) return [];
  return db.getAllAsync(
    `SELECT entry_id, uri, sort_order FROM diary_photos
      WHERE entry_id IN (${placeholders(entryIds)}) ORDER BY entry_id, sort_order, created_at`,
    entryIds,
  );
}

export async function insertPhotoRow(db, p) {
  await db.runAsync(
    `INSERT INTO diary_photos (id, entry_id, uri, width, height, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.entryId, p.uri, p.width, p.height, p.sortOrder, p.nowIso],
  );
}

export async function setPhotoOrder(db, id, sortOrder) {
  await db.runAsync('UPDATE diary_photos SET sort_order = ? WHERE id = ?', [sortOrder, id]);
}

export async function deletePhotoRows(db, ids) {
  if (ids.length === 0) return;
  await db.runAsync(`DELETE FROM diary_photos WHERE id IN (${placeholders(ids)})`, ids);
}

// Seeded tags first (insertion order), then the user's own.
export async function listAllTags(db) {
  return db.getAllAsync('SELECT id, name FROM diary_tags ORDER BY created_at, rowid');
}

// The column is COLLATE NOCASE, so this comparison ignores case.
export async function findTagByName(db, name) {
  return db.getFirstAsync('SELECT id, name FROM diary_tags WHERE name = ?', [name]);
}

export async function insertTagRow(db, t) {
  await db.runAsync('INSERT INTO diary_tags (id, name, created_at) VALUES (?, ?, ?)', [t.id, t.name, t.nowIso]);
}

export async function listTagsForEntries(db, entryIds) {
  if (entryIds.length === 0) return [];
  return db.getAllAsync(
    `SELECT et.entry_id, t.id, t.name
       FROM entry_tags et JOIN diary_tags t ON t.id = et.tag_id
      WHERE et.entry_id IN (${placeholders(entryIds)})
      ORDER BY t.created_at, t.rowid`,
    entryIds,
  );
}

export async function clearEntryTags(db, entryId) {
  await db.runAsync('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
}

export async function linkEntryTag(db, entryId, tagId) {
  await db.runAsync('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [entryId, tagId]);
}
