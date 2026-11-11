import { getDatabase } from '../../database/client';
import { loadHabitsOverview } from './habitOverview';
import { advanceHabit, createHabit, deleteHabit, setHabitArchived, updateHabit } from './habitService';

async function withDb(fn) {
  return fn(await getDatabase());
}

export const habitActions = {
  load: (today) => withDb((db) => loadHabitsOverview(db, today)),
  advance: (habitId) => withDb((db) => advanceHabit(db, habitId)),
  create: (input) => withDb((db) => createHabit(db, input)),
  update: (habitId, input) => withDb((db) => updateHabit(db, habitId, input)),
  archive: (habitId, archived) => withDb((db) => setHabitArchived(db, habitId, archived)),
  remove: (habitId) => withDb((db) => deleteHabit(db, habitId)),
};
