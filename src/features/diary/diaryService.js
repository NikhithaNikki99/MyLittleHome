import {
  clearEntryTags,
  deleteEntryRow,
  deletePhotoRows,
  findTagByName,
  getEntryRow,
  insertEntryRow,
  insertPhotoRow,
  insertTagRow,
  linkEntryTag,
  listAllTags,
  listEntryDates,
  listEntryRows,
  listPhotos,
  listPhotosForEntries,
  listTagsForEntries,
  setEntryFavorite,
  setPhotoOrder,
  updateEntryRow,
} from '../../database/repositories/diaryRepository';
import { monthRange, nowIso } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { escapeLike, normalizeEntryInput } from './diaryLogic';

// `files` is the photo store: { importPhoto(uri) -> Promise<storedUri>, removePhoto(uri) -> Promise<void> }.
// It is passed in so the data rules can be tested without a device file system.

const DEFAULT_LIST_LIMIT = 200;

function toEntry(row, photos, tags) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    entryDate: row.entry_date,
    entryTime: row.entry_time,
    mood: row.mood,
    isFavorite: row.is_favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: photos.map((p) => ({ id: p.id, uri: p.uri, width: p.width, height: p.height })),
    tags,
  };
}

async function safeRemove(files, uris) {
  for (const uri of uris) {
    try {
      await files.removePhoto(uri);
    } catch {
      // A leftover file is harmless; never let cleanup mask the real result.
    }
  }
}

// Returns the tag id, creating the tag if it does not exist. Names are matched ignoring case.
async function resolveTagId(db, name, now) {
  const existing = await findTagByName(db, name);
  if (existing) return existing.id;
  const id = newId();
  await insertTagRow(db, { id, name, nowIso: now });
  return id;
}

async function writeTags(db, entryId, tagNames, now) {
  await clearEntryTags(db, entryId);
  for (const name of tagNames) {
    await linkEntryTag(db, entryId, await resolveTagId(db, name, now));
  }
}

export async function createEntry(db, input, files) {
  const entry = normalizeEntryInput(input);
  if (entry.photos.some((p) => p.id)) throw new ValidationError('One of the photos could not be read.');

  const copied = [];
  try {
    for (const photo of entry.photos) copied.push(await files.importPhoto(photo.uri));

    const id = newId();
    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await insertEntryRow(db, { ...entry, id, nowIso: now });
      for (let i = 0; i < copied.length; i++) {
        await insertPhotoRow(db, {
          id: newId(),
          entryId: id,
          uri: copied[i],
          width: entry.photos[i].width,
          height: entry.photos[i].height,
          sortOrder: i,
          nowIso: now,
        });
      }
      await writeTags(db, id, entry.tagNames, now);
    });
    return id;
  } catch (error) {
    await safeRemove(files, copied);
    throw error;
  }
}

export async function updateEntry(db, id, input, files) {
  const existing = await getEntryRow(db, id);
  if (!existing) throw new ValidationError('That entry no longer exists.');
  const entry = normalizeEntryInput(input);

  const currentPhotos = await listPhotos(db, id);
  const currentById = new Map(currentPhotos.map((p) => [p.id, p]));
  const keptIds = entry.photos.filter((p) => p.id).map((p) => p.id);
  if (keptIds.some((photoId) => !currentById.has(photoId)) || new Set(keptIds).size !== keptIds.length) {
    throw new ValidationError('One of the photos could not be read.');
  }
  const removed = currentPhotos.filter((p) => !keptIds.includes(p.id));

  const copied = new Map();
  try {
    for (let i = 0; i < entry.photos.length; i++) {
      if (!entry.photos[i].id) copied.set(i, await files.importPhoto(entry.photos[i].uri));
    }

    const now = nowIso();
    await db.withTransactionAsync(async () => {
      await updateEntryRow(db, { ...entry, id, nowIso: now });
      await deletePhotoRows(db, removed.map((p) => p.id));
      for (let i = 0; i < entry.photos.length; i++) {
        const photo = entry.photos[i];
        if (photo.id) {
          await setPhotoOrder(db, photo.id, i);
        } else {
          await insertPhotoRow(db, {
            id: newId(),
            entryId: id,
            uri: copied.get(i),
            width: photo.width,
            height: photo.height,
            sortOrder: i,
            nowIso: now,
          });
        }
      }
      await writeTags(db, id, entry.tagNames, now);
    });
  } catch (error) {
    await safeRemove(files, [...copied.values()]);
    throw error;
  }
  // Only after the commit: a failed write must not cost the user their existing photos.
  await safeRemove(files, removed.map((p) => p.uri));
}

export async function deleteEntry(db, id, files) {
  const photos = await listPhotos(db, id);
  await deleteEntryRow(db, id);
  await safeRemove(files, photos.map((p) => p.uri));
}

export async function setFavorite(db, id, isFavorite) {
  const changed = await setEntryFavorite(db, id, Boolean(isFavorite), nowIso());
  if (changed === 0) throw new ValidationError('That entry no longer exists.');
}

export async function getEntry(db, id) {
  const row = await getEntryRow(db, id);
  if (!row) return null;
  const [photos, tagRows] = await Promise.all([listPhotos(db, id), listTagsForEntries(db, [id])]);
  return toEntry(
    row,
    photos,
    tagRows.map((t) => ({ id: t.id, name: t.name })),
  );
}

// Summaries for the list: newest first, with the first photo and tags attached.
export async function listEntries(db, { date = null, query = '', favoritesOnly = false, limit = DEFAULT_LIST_LIMIT } = {}) {
  const term = typeof query === 'string' ? query.trim() : '';
  const rows = await listEntryRows(db, {
    date,
    likePattern: term ? `%${escapeLike(term)}%` : null,
    favoritesOnly,
    limit,
  });
  const ids = rows.map((r) => r.id);
  const [photoRows, tagRows] = await Promise.all([listPhotosForEntries(db, ids), listTagsForEntries(db, ids)]);

  const photoCount = new Map();
  const firstPhoto = new Map();
  for (const p of photoRows) {
    photoCount.set(p.entry_id, (photoCount.get(p.entry_id) ?? 0) + 1);
    if (!firstPhoto.has(p.entry_id)) firstPhoto.set(p.entry_id, p.uri);
  }
  const tagsByEntry = new Map();
  for (const t of tagRows) {
    if (!tagsByEntry.has(t.entry_id)) tagsByEntry.set(t.entry_id, []);
    tagsByEntry.get(t.entry_id).push({ id: t.id, name: t.name });
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.snippet,
    entryDate: r.entry_date,
    entryTime: r.entry_time,
    mood: r.mood,
    isFavorite: r.is_favorite === 1,
    thumbnailUri: firstPhoto.get(r.id) ?? null,
    photoCount: photoCount.get(r.id) ?? 0,
    tags: tagsByEntry.get(r.id) ?? [],
  }));
}

// Dates in the month ('YYYY-MM') that have entries, for the calendar dots.
export async function getMonthMarks(db, monthKey) {
  const { start, endExclusive } = monthRange(`${monthKey}-01`);
  const rows = await listEntryDates(db, start, endExclusive);
  return rows.map((r) => r.entry_date);
}

// Tags are created as part of saving an entry, so cancelling a form never leaves stray tags behind.
export async function listTags(db) {
  return listAllTags(db);
}
