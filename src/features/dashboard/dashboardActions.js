import { SETTING_KEYS } from '../../constants/settingKeys';
import { getDatabase } from '../../database/client';
import { setSetting } from '../../database/repositories/settingsRepository';
import { useDashboardStore } from '../../store/dashboardStore';
import { toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { addTransaction } from '../expenses/expenseService';
import { advanceHabit, createHabit } from '../habits/habitService';
import { addTask, toggleTask } from '../planner/taskService';
import { addWater, addWeight, setMood } from '../wellness/wellnessService';
import { loadDashboard } from './dashboardService';

export async function refreshDashboard() {
  const store = useDashboardStore.getState();
  store.setLoading();
  try {
    const db = await getDatabase();
    store.setData(await loadDashboard(db, toDateKey()));
  } catch (error) {
    store.setError(error);
  }
}

// Runs a write against SQLite, then re-reads the dashboard so the cache reflects the database.
async function write(fn) {
  const db = await getDatabase();
  await fn(db);
  await refreshDashboard();
}

export const dashboardActions = {
  setMood: (mood) => write((db) => setMood(db, { mood })),
  addWater: (amountMl) => write((db) => addWater(db, { amountMl })),
  addWeight: (weightKg) => write((db) => addWeight(db, { weightKg })),
  addExpense: (input) => write((db) => addTransaction(db, { ...input, kind: 'expense' })),
  toggleHabit: (habitId) => write((db) => advanceHabit(db, habitId)),
  toggleTask: (taskId) => write((db) => toggleTask(db, taskId)),
  addTask: (input) => write((db) => addTask(db, input)),
  createHabit: (input) => write((db) => createHabit(db, input)),
  setWaterGoal: async (goalMl) => {
    if (!Number.isInteger(goalMl) || goalMl < 500 || goalMl > 10000) {
      throw new ValidationError('Choose a goal between 500 ml and 10,000 ml.');
    }
    await write((db) => setSetting(db, SETTING_KEYS.WATER_GOAL_ML, goalMl));
  },
};
