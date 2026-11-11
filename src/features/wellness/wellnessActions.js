import { getDatabase } from '../../database/client';
import {
  addWater,
  addWeight,
  loadWellnessOverview,
  removeSleep,
  removeWaterLog,
  removeWeight,
  saveSleep,
  setMood,
  setSleepGoalMinutes,
  setWaterGoalMl,
  setWeightGoalKg,
  updateWeight,
} from './wellnessService';

// Screen-facing entry points: open the shared database, then call the service.
async function withDb(fn) {
  return fn(await getDatabase());
}

export const wellnessActions = {
  load: (today) => withDb((db) => loadWellnessOverview(db, today)),
  setMood: (mood) => withDb((db) => setMood(db, { mood })),
  addWater: (amountMl) => withDb((db) => addWater(db, { amountMl })),
  removeWaterLog: (id) => withDb((db) => removeWaterLog(db, id)),
  setWaterGoal: (goalMl) => withDb((db) => setWaterGoalMl(db, goalMl)),
  addWeight: (input) => withDb((db) => addWeight(db, input)),
  updateWeight: (id, input) => withDb((db) => updateWeight(db, id, input)),
  removeWeight: (id) => withDb((db) => removeWeight(db, id)),
  setWeightGoal: (goalKg) => withDb((db) => setWeightGoalKg(db, goalKg)),
  saveSleep: (input) => withDb((db) => saveSleep(db, input)),
  removeSleep: (logDate) => withDb((db) => removeSleep(db, logDate)),
  setSleepGoal: (minutes) => withDb((db) => setSleepGoalMinutes(db, minutes)),
};
