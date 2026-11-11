import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { setSetting } from '../src/database/repositories/settingsRepository';
import {
  addWater,
  addWeight,
  getWeightGoalKg,
  loadWellnessOverview,
  readSleepGoalMinutes,
  readWaterGoalMl,
  removeSleep,
  removeWaterLog,
  removeWeight,
  saveSleep,
  setMood,
  setSleepGoalMinutes,
  setWaterGoalMl,
  setWeightGoalKg,
  updateWeight,
} from '../src/features/wellness/wellnessService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

// Wednesday.
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('overview on an empty database', () => {
  test('shows nulls and zero-filled series, never invented data', async () => {
    const db = await freshDb();
    const o = await loadWellnessOverview(db, TODAY);

    expect(o.mood.today).toBeNull();
    expect(o.mood.series).toHaveLength(30);
    expect(o.mood.series.every((d) => d.value === null)).toBe(true);
    expect(o.water.todayMl).toBe(0);
    expect(o.water.goalMl).toBe(2000);
    expect(o.water.week.map((d) => d.value)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(o.water.weekAverageMl).toBe(0);
    expect(o.weight).toMatchObject({ latest: null, startKg: null, goalKg: null, entries: [] });
    expect(o.sleep.last).toBeNull();
    expect(o.sleep.week.every((d) => d.value === null)).toBe(true);
    expect(o.sleep.weekAverageMinutes).toBeNull();
    expect(o.sleep.goalMinutes).toBe(480);
  });
});

describe('mood', () => {
  test('the 30-day strip carries one value per day and null for gaps', async () => {
    const db = await freshDb();
    await setMood(db, { mood: 4, logDate: TODAY });
    await setMood(db, { mood: 2, logDate: '2026-11-09' });
    await setMood(db, { mood: 5, logDate: '2026-11-09' }); // same day: updates

    const o = await loadWellnessOverview(db, TODAY);
    expect(o.mood.today).toBe(4);
    const byDate = Object.fromEntries(o.mood.series.map((d) => [d.date, d.value]));
    expect(byDate['2026-11-09']).toBe(5);
    expect(byDate['2026-11-10']).toBeNull();
    expect(o.mood.series[0].date).toBe('2026-10-13');
    expect(o.mood.series[29].date).toBe(TODAY);
  });

  test('a mood older than 30 days is outside the strip', async () => {
    const db = await freshDb();
    await setMood(db, { mood: 3, logDate: '2026-10-12' });
    const o = await loadWellnessOverview(db, TODAY);
    expect(o.mood.series.every((d) => d.value === null)).toBe(true);
  });
});

describe('water', () => {
  test('daily totals, a zero-filled 7-day series and the average', async () => {
    const db = await freshDb();
    await addWater(db, { amountMl: 250, logDate: TODAY });
    await addWater(db, { amountMl: 500, logDate: TODAY });
    await addWater(db, { amountMl: 700, logDate: '2026-11-09' });
    await addWater(db, { amountMl: 1000, logDate: '2026-11-04' }); // 7 days back: outside the week

    const o = await loadWellnessOverview(db, TODAY);
    expect(o.water.todayMl).toBe(750);
    expect(o.water.week.map((d) => d.date)).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
    expect(o.water.week.map((d) => d.value)).toEqual([0, 0, 0, 0, 700, 0, 750]);
    expect(o.water.weekAverageMl).toBe(207); // round(1450 / 7)
    expect(o.water.todayLogs.map((l) => l.amountMl).sort()).toEqual([250, 500]);
  });

  test('a log can be deleted and the totals follow', async () => {
    const db = await freshDb();
    await addWater(db, { amountMl: 250, logDate: TODAY });
    await addWater(db, { amountMl: 500, logDate: TODAY });
    const before = await loadWellnessOverview(db, TODAY);
    const big = before.water.todayLogs.find((l) => l.amountMl === 500);

    await removeWaterLog(db, big.id);
    expect((await loadWellnessOverview(db, TODAY)).water.todayMl).toBe(250);
  });

  test('goal bounds are 500 to 10,000 ml and bad stored values fall back to the default', async () => {
    const db = await freshDb();
    await expect(setWaterGoalMl(db, 499)).rejects.toThrow(/between 500 ml and 10,000 ml/);
    await expect(setWaterGoalMl(db, 10001)).rejects.toThrow(/between 500 ml/);
    await expect(setWaterGoalMl(db, 2500.5)).rejects.toThrow(/between 500 ml/);
    await setWaterGoalMl(db, 500);
    expect(await readWaterGoalMl(db)).toBe(500);
    await setWaterGoalMl(db, 10000);
    expect(await readWaterGoalMl(db)).toBe(10000);

    await setSetting(db, 'water_goal_ml', 'lots');
    expect(await readWaterGoalMl(db)).toBe(2000);
    expect((await loadWellnessOverview(db, TODAY)).water.goalMl).toBe(2000);
  });
});

describe('weight', () => {
  test('lists newest first, tracks first and latest, and compares with the previous entry', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 72, entryDate: '2026-11-01' });
    await addWeight(db, { weightKg: 71.4, entryDate: '2026-11-05' });
    await addWeight(db, { weightKg: 71.9, entryDate: '2026-11-10' });

    const w = (await loadWellnessOverview(db, TODAY)).weight;
    expect(w.entries.map((e) => e.kg)).toEqual([71.9, 71.4, 72]);
    expect(w.startKg).toBe(72);
    expect(w.startDate).toBe('2026-11-01');
    expect(w.latest).toMatchObject({ kg: 71.9, date: '2026-11-10' });
    expect(w.previousKg).toBe(71.4);
  });

  test('a back-dated entry never becomes the latest', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 70, entryDate: '2026-11-10' });
    await addWeight(db, { weightKg: 75, entryDate: '2026-10-01' });
    const w = (await loadWellnessOverview(db, TODAY)).weight;
    expect(w.latest.kg).toBe(70);
    expect(w.startKg).toBe(75);
  });

  test('edit changes the value, date and note; unknown ids and bad input are rejected', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 70, entryDate: '2026-11-10' });
    const id = (await loadWellnessOverview(db, TODAY)).weight.entries[0].id;

    await updateWeight(db, id, { weightKg: 69.5, entryDate: '2026-11-09', note: '  after trip ' });
    const entry = (await loadWellnessOverview(db, TODAY)).weight.entries[0];
    expect(entry).toMatchObject({ kg: 69.5, date: '2026-11-09', note: 'after trip' });

    await expect(updateWeight(db, id, { weightKg: 19, entryDate: TODAY })).rejects.toThrow(/between 20 and 300/);
    await expect(updateWeight(db, id, { weightKg: 70, entryDate: '2026-02-30' })).rejects.toThrow(/date/);
    await expect(updateWeight(db, 'ghost', { weightKg: 70, entryDate: TODAY })).rejects.toThrow(/no longer exists/);
    await expect(updateWeight(db, id, { weightKg: 70, entryDate: TODAY, note: 'x'.repeat(501) })).rejects.toThrow(
      /under 500/,
    );
  });

  test('delete removes the entry and the latest falls back to the one before', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 70, entryDate: '2026-11-01' });
    await addWeight(db, { weightKg: 71, entryDate: '2026-11-10' });
    const newest = (await loadWellnessOverview(db, TODAY)).weight.entries[0];

    await removeWeight(db, newest.id);
    const w = (await loadWellnessOverview(db, TODAY)).weight;
    expect(w.latest.kg).toBe(70);
    expect(w.entries).toHaveLength(1);
  });

  test('the optional goal can be set, replaced and cleared; out-of-range values are rejected', async () => {
    const db = await freshDb();
    expect(await getWeightGoalKg(db)).toBeNull();
    await setWeightGoalKg(db, 65.5);
    expect(await getWeightGoalKg(db)).toBe(65.5);
    expect((await loadWellnessOverview(db, TODAY)).weight.goalKg).toBe(65.5);
    await setWeightGoalKg(db, 64);
    expect(await getWeightGoalKg(db)).toBe(64);
    await expect(setWeightGoalKg(db, 10)).rejects.toThrow(/between 20 and 300/);
    await expect(setWeightGoalKg(db, '65')).rejects.toThrow(/between 20 and 300/);
    await setWeightGoalKg(db, null);
    expect(await getWeightGoalKg(db)).toBeNull();
  });
});

describe('sleep', () => {
  test('saving the same date again replaces it (one record per date)', async () => {
    const db = await freshDb();
    await saveSleep(db, { minutes: 420, quality: 3, logDate: TODAY });
    await saveSleep(db, { minutes: 465, quality: 4, logDate: TODAY, note: ' woke once ' });

    expect(await db.getAllAsync('SELECT * FROM sleep_logs')).toHaveLength(1);
    const o = await loadWellnessOverview(db, TODAY);
    expect(o.sleep.last).toEqual({ date: TODAY, minutes: 465, quality: 4 });
    expect(o.sleep.entries[0].note).toBe('woke once');
  });

  test('week series is null-filled and averages only the nights that were logged', async () => {
    const db = await freshDb();
    await saveSleep(db, { minutes: 420, logDate: TODAY });
    await saveSleep(db, { minutes: 480, logDate: '2026-11-09' });

    const o = await loadWellnessOverview(db, TODAY);
    expect(o.sleep.week.map((d) => d.value)).toEqual([null, null, null, null, 480, null, 420]);
    expect(o.sleep.weekAverageMinutes).toBe(450);
    expect(o.sleep.week[6].quality).toBeNull();
  });

  test('validates duration, rating and date', async () => {
    const db = await freshDb();
    await expect(saveSleep(db, { minutes: 0 })).rejects.toThrow(/1 minute and 24 hours/);
    await expect(saveSleep(db, { minutes: 1441 })).rejects.toThrow(/24 hours/);
    await expect(saveSleep(db, { minutes: 90.5 })).rejects.toThrow(/24 hours/);
    await expect(saveSleep(db, { minutes: 420, quality: 6 })).rejects.toThrow(/1 to 5/);
    await expect(saveSleep(db, { minutes: 420, quality: 0 })).rejects.toThrow(/1 to 5/);
    await expect(saveSleep(db, { minutes: 420, logDate: '2026-13-01' })).rejects.toThrow(/date/);
    await saveSleep(db, { minutes: 1, quality: null, logDate: TODAY });
    await saveSleep(db, { minutes: 1440, quality: 5, logDate: '2026-11-10' });
    expect(await db.getAllAsync('SELECT * FROM sleep_logs')).toHaveLength(2);
  });

  test('delete removes only that night', async () => {
    const db = await freshDb();
    await saveSleep(db, { minutes: 420, logDate: TODAY });
    await saveSleep(db, { minutes: 400, logDate: '2026-11-10' });
    await removeSleep(db, TODAY);
    const o = await loadWellnessOverview(db, TODAY);
    expect(o.sleep.last).toMatchObject({ date: '2026-11-10', minutes: 400 });
  });

  test('goal bounds are 2 to 16 hours; bad stored values fall back to 8 hours', async () => {
    const db = await freshDb();
    await expect(setSleepGoalMinutes(db, 119)).rejects.toThrow(/2 and 16 hours/);
    await expect(setSleepGoalMinutes(db, 961)).rejects.toThrow(/2 and 16 hours/);
    await setSleepGoalMinutes(db, 450);
    expect(await readSleepGoalMinutes(db)).toBe(450);
    await setSetting(db, 'sleep_goal_minutes', 'x');
    expect(await readSleepGoalMinutes(db)).toBe(480);
  });
});
