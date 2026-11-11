import { getDatabase } from '../../database/client';
import {
  createEntry,
  deleteEntry,
  getEntry,
  getMonthMarks,
  listEntries,
  listTags,
  setFavorite,
  updateEntry,
} from './diaryService';
import { photoFiles } from './photoStore';

// Thin bindings of the diary service to the shared database and the on-device photo store.
// Screens call these and never touch SQL or the file system directly.
export const diaryActions = {
  async list(filters) {
    return listEntries(await getDatabase(), filters);
  },
  async monthMarks(monthKey) {
    return getMonthMarks(await getDatabase(), monthKey);
  },
  async get(id) {
    return getEntry(await getDatabase(), id);
  },
  async tags() {
    return listTags(await getDatabase());
  },
  async create(input) {
    return createEntry(await getDatabase(), input, photoFiles);
  },
  async update(id, input) {
    return updateEntry(await getDatabase(), id, input, photoFiles);
  },
  async remove(id) {
    return deleteEntry(await getDatabase(), id, photoFiles);
  },
  async setFavorite(id, isFavorite) {
    return setFavorite(await getDatabase(), id, isFavorite);
  },
};
