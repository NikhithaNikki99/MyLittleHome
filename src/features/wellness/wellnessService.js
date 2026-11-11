import { SETTING_KEYS } from '../../constants/settingKeys';
import { getSetting, setSetting } from '../../database/repositories/settingsRepository';
import { deleteSleepForDate, getLatestSleep, listRecentSleep, listSleepInRange, upsertSleep } from '../../database/repositories/sleepRepository';
import {
  deleteSettingKey,
  deleteWaterLog,
  deleteWeightEntry,
  getFirstWeightEntry,
  getLatestWeightEntry,
  getMoodForDate,
  getPreviousWeightEntry,
  getWaterTotalForDate,
  getWeightEntryById,
  insertWaterLog,
  insertWeightEntry,
  listMoodsInRange,
  listWaterLogsForDate,
  listWaterTotalsInRange,
  listWeightEntries,
  updateWeightEntry,
  upsertMood,
} from '../../database/repositories/wellnessRepository';
import { addDays, isValidDateKey, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { MAX_WATER_ML_PER_LOG, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from '../../utils/units';
import { average, fillSeries, lastNDays } from './wellnessStats';

export const DEFAULT_WATER_GOAL_ML = 2000;

// Every function takes `db` first so it runs against the app database or a test database.
export async function setMood(db, { mood, logDate = toDateKey(), note = null }) {
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) throw new ValidationError('Pick a mood from 1 to 5.');
  if (!isValidDateKey(logDate)) throw new ValidationError('That date is not valid.');
  await upsertMood(db, { id: newId(), logDate, mood, note, nowIso: nowIso() });
}

export async function addWater(db, { amountMl, logDate = toDateKey() }) {
  if (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > MAX_WATER_ML_PER_LOG) {
    throw new ValidationError(`Enter between 1 and ${MAX_WATER_ML_PER_LOG} ml.`);
  }
  if (!isValidDateKey(logDate)) throw new ValidationError('That date is not valid.');
  await insertWaterLog(db, { id: newId(), logDate, amountMl, nowIso: nowIso() });
}

export async function addWeight(db, { weightKg, entryDate = toDateKey(), note = null }) {
  if (typeof weightKg !== 'number' || !(weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG)) {
    throw new ValidationError(`Enter a weight between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`);
  }
  if (!isValidDateKey(entryDate)) throw new ValidationError('That date is not valid.');
  await insertWeightEntry(db, { id: newId(), entryDate, weightKg, note, nowIso: nowIso() });
}

export async function getWellnessSnapshot(db, dateKey, waterGoalMl) {
  const [mood, waterMl, latest] = await Promise.all([
    getMoodForDate(db, dateKey),
    getWaterTotalForDate(db, dateKey),
    getLatestWeightEntry(db),
  ]);
  const previous = latest ? await getPreviousWeightEntry(db, latest) : null;
  return {
    mood: mood ? mood.mood : null,
    water: { totalMl: waterMl, goalMl: waterGoalMl },
    weight: latest
      ? {
          kg: latest.weight_kg,
          date: latest.entry_date,
          previousKg: previous ? previous.weight_kg : null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Wellness screen: edit/delete, goals and series. Everything above is used by the Home dashboard
// and keeps its signature.
// ---------------------------------------------------------------------------------------------

export const WEIGHT_GOAL_KEY = 'weight_goal_kg';
export const MIN_WATER_GOAL_ML = 500;
export const MAX_WATER_GOAL_ML = 10000;
export const DEFAULT_SLEEP_GOAL_MINUTES = 480;
export const MIN_SLEEP_GOAL_MINUTES = 120;
export const MAX_SLEEP_GOAL_MINUTES = 960;
export const MAX_NOTE_LENGTH = 500;

function cleanNote(note) {
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > MAX_NOTE_LENGTH) throw new ValidationError(`Keep notes under ${MAX_NOTE_LENGTH} characters.`);
  return text || null;
}

function requireWeight(weightKg) {
  if (typeof weightKg !== 'number' || !(weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG)) {
    throw new ValidationError(`Enter a weight between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`);
  }
}

function requireDate(dateKey) {
  if (!isValidDateKey(dateKey)) throw new ValidationError('That date is not valid.');
}

// ---- Weight ----
export async function updateWeight(db, id, { weightKg, entryDate, note = null }) {
  requireWeight(weightKg);
  requireDate(entryDate);
  const existing = await getWeightEntryById(db, id);
  if (!existing) throw new ValidationError('That entry no longer exists.');
  await updateWeightEntry(db, { id, entryDate, weightKg, note: cleanNote(note), nowIso: nowIso() });
}

export async function removeWeight(db, id) {
  await deleteWeightEntry(db, id);
}

export async function getWeightGoalKg(db) {
  const raw = await getSetting(db, WEIGHT_GOAL_KEY);
  if (raw === null) return null;
  const kg = Number(raw);
  return Number.isFinite(kg) && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG ? kg : null;
}

// null clears the goal.
export async function setWeightGoalKg(db, goalKg) {
  if (goalKg === null) {
    await deleteSettingKey(db, WEIGHT_GOAL_KEY);
    return;
  }
  requireWeight(goalKg);
  await setSetting(db, WEIGHT_GOAL_KEY, goalKg);
}

// ---- Water ----
export async function removeWaterLog(db, id) {
  await deleteWaterLog(db, id);
}

export async function setWaterGoalMl(db, goalMl) {
  if (!Number.isInteger(goalMl) || goalMl < MIN_WATER_GOAL_ML || goalMl > MAX_WATER_GOAL_ML) {
    throw new ValidationError('Choose a goal between 500 ml and 10,000 ml.');
  }
  await setSetting(db, SETTING_KEYS.WATER_GOAL_ML, goalMl);
}

export async function readWaterGoalMl(db) {
  const goal = Number(await getSetting(db, SETTING_KEYS.WATER_GOAL_ML));
  return Number.isInteger(goal) && goal >= MIN_WATER_GOAL_ML && goal <= MAX_WATER_GOAL_ML
    ? goal
    : DEFAULT_WATER_GOAL_ML;
}

// ---- Sleep ----
// One record per date (the day you woke up); saving again for the same date replaces it.
export async function saveSleep(db, { minutes, quality = null, logDate = toDateKey(), note = null }) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new ValidationError('Enter a sleep time between 1 minute and 24 hours.');
  }
  if (quality !== null && (!Number.isInteger(quality) || quality < 1 || quality > 5)) {
    throw new ValidationError('Rate sleep from 1 to 5, or leave it blank.');
  }
  requireDate(logDate);
  await upsertSleep(db, { id: newId(), logDate, minutes, quality, note: cleanNote(note), nowIso: nowIso() });
}

export async function removeSleep(db, logDate) {
  requireDate(logDate);
  await deleteSleepForDate(db, logDate);
}

export async function setSleepGoalMinutes(db, minutes) {
  if (!Number.isInteger(minutes) || minutes < MIN_SLEEP_GOAL_MINUTES || minutes > MAX_SLEEP_GOAL_MINUTES) {
    throw new ValidationError('Choose a sleep goal between 2 and 16 hours.');
  }
  await setSetting(db, SETTING_KEYS.SLEEP_GOAL_MINUTES, minutes);
}

export async function readSleepGoalMinutes(db) {
  const goal = Number(await getSetting(db, SETTING_KEYS.SLEEP_GOAL_MINUTES));
  return Number.isInteger(goal) && goal >= MIN_SLEEP_GOAL_MINUTES && goal <= MAX_SLEEP_GOAL_MINUTES
    ? goal
    : DEFAULT_SLEEP_GOAL_MINUTES;
}

// ---- Overview ----
const MOOD_STRIP_DAYS = 30;
const WEEK_DAYS = 7;
const WEIGHT_LIST_LIMIT = 60;
const SLEEP_LIST_LIMIT = 30;

// Everything the Wellness screen needs for one local date. Series are zero-filled (water) or
// null-filled (mood, sleep) so a missing day is shown as "nothing logged", never as a 0.
export async function loadWellnessOverview(db, today) {
  const weekKeys = lastNDays(today, WEEK_DAYS);
  const moodKeys = lastNDays(today, MOOD_STRIP_DAYS);
  const rangeEnd = addDays(today, 1);

  const [
    waterGoalMl,
    sleepGoalMinutes,
    weightGoalKg,
    latest,
    first,
    weightRows,
    waterTodayLogs,
    waterRows,
    moodRows,
    sleepRows,
    sleepRecent,
    lastSleep,
  ] = await Promise.all([
    readWaterGoalMl(db),
    readSleepGoalMinutes(db),
    getWeightGoalKg(db),
    getLatestWeightEntry(db),
    getFirstWeightEntry(db),
    listWeightEntries(db, WEIGHT_LIST_LIMIT),
    listWaterLogsForDate(db, today),
    listWaterTotalsInRange(db, weekKeys[0], rangeEnd),
    listMoodsInRange(db, moodKeys[0], rangeEnd),
    listSleepInRange(db, weekKeys[0], rangeEnd),
    listRecentSleep(db, SLEEP_LIST_LIMIT),
    getLatestSleep(db),
  ]);

  const waterWeek = fillSeries(weekKeys, waterRows, 'log_date', 'total', 0);
  const waterTodayMl = waterWeek[waterWeek.length - 1].value;
  const moodSeries = fillSeries(moodKeys, moodRows, 'log_date', 'mood', null);
  const sleepWeek = fillSeries(weekKeys, sleepRows, 'log_date', 'minutes', null);
  const sleepQualityByDate = new Map(sleepRows.map((r) => [r.log_date, r.quality]));

  const previous = latest ? await getPreviousWeightEntry(db, latest) : null;

  return {
    today,
    mood: {
      today: moodSeries[moodSeries.length - 1].value,
      series: moodSeries,
    },
    water: {
      todayMl: waterTodayMl,
      goalMl: waterGoalMl,
      todayLogs: waterTodayLogs.map((r) => ({ id: r.id, amountMl: r.amount_ml, loggedAt: r.logged_at })),
      week: waterWeek,
      weekAverageMl: average(waterWeek.map((d) => d.value)),
    },
    weight: {
      latest: latest ? { id: latest.id, date: latest.entry_date, kg: latest.weight_kg } : null,
      previousKg: previous ? previous.weight_kg : null,
      startKg: first ? first.weight_kg : null,
      startDate: first ? first.entry_date : null,
      goalKg: weightGoalKg,
      entries: weightRows.map((r) => ({ id: r.id, date: r.entry_date, kg: r.weight_kg, note: r.note })),
    },
    sleep: {
      goalMinutes: sleepGoalMinutes,
      last: lastSleep
        ? { date: lastSleep.log_date, minutes: lastSleep.minutes, quality: lastSleep.quality }
        : null,
      week: sleepWeek.map((d) => ({ ...d, quality: sleepQualityByDate.get(d.date) ?? null })),
      weekAverageMinutes: average(sleepWeek.map((d) => d.value)),
      entries: sleepRecent.map((r) => ({
        date: r.log_date,
        minutes: r.minutes,
        quality: r.quality,
        note: r.note,
      })),
    },
  };
}
