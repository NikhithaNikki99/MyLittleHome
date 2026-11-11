import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { readAllTables, replaceAllTables } from '../src/database/repositories/backupRepository';
import { describeSchedule, formatStreak } from '../src/features/habits/habitOptions';
import { loadHabitsOverview } from '../src/features/habits/habitOverview';
import {
  countInRange,
  daysBetween,
  dueInfo,
  isScheduledOn,
  listWindows,
  monthlyDate,
  windowFor,
} from '../src/features/habits/habitSchedule';
import { advanceHabit, createHabit, getHabitsForDate, updateHabit } from '../src/features/habits/habitService';
import { computeStreaks, overallStreak, weeklyProgress } from '../src/features/habits/habitStats';
import { buildBackupDocument, validateBackupText } from '../src/features/settings/backupFormat';
import { ordinal } from '../src/utils/ordinal';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

// 2026-11-11 is a Wednesday. Weeks run Monday to Sunday: 9-15 November is the current week.
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const habit = (over = {}) => ({
  id: 'h',
  startDate: '2026-10-01',
  scheduleType: 'weekdays',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  intervalDays: null,
  weeklyTarget: null,
  monthDay: null,
  ...over,
});
const set = (...keys) => new Set(keys);
const make = (db, over = {}) => createHabit(db, { name: 'Read', startDate: '2026-10-01', ...over });
const idOf = async (db, name = 'Read') => (await db.getFirstAsync('SELECT id FROM habits WHERE name = ?', [name])).id;
const dueNames = async (db, date) => (await getHabitsForDate(db, date)).map((h) => h.name);

describe('small helpers', () => {
  test('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ]);
  });

  test('daysBetween is exact across month ends and DST changes', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-11', '2026-11-11')).toBe(0);
  });

  test('monthlyDate falls back to the last day of a short month', () => {
    expect(monthlyDate('2026-02', 31)).toBe('2026-02-28');
    expect(monthlyDate('2028-02', 30)).toBe('2028-02-29');
    expect(monthlyDate('2026-04', 31)).toBe('2026-04-30');
    expect(monthlyDate('2026-05', 31)).toBe('2026-05-31');
  });

  test('schedule descriptions and streak wording', () => {
    expect(describeSchedule([1, 3])).toBe('Mon, Wed');
    expect(describeSchedule(habit({ scheduleType: 'weekly_count', weeklyTarget: 3 }))).toBe('3 times a week');
    expect(describeSchedule(habit({ scheduleType: 'weekly_count', weeklyTarget: 1 }))).toBe('Once a week');
    expect(describeSchedule(habit({ scheduleType: 'interval', intervalDays: 3 }))).toBe('Every 3 days');
    expect(describeSchedule(habit({ scheduleType: 'monthly_day', monthDay: 22 }))).toBe('Monthly on the 22nd');
    expect(describeSchedule(habit({ weekdays: [1, 2, 3, 4, 5] }))).toBe('Weekdays');
    expect(formatStreak(1, 'week')).toBe('1 week');
    expect(formatStreak(3, 'month')).toBe('3 months');
    expect(formatStreak(2, 'time')).toBe('2 times in a row');
    expect(formatStreak(1, 'day')).toBe('1 day');
  });
});

describe('isScheduledOn', () => {
  test('weekday habits are unchanged', () => {
    const h = habit({ weekdays: [3] });
    expect(isScheduledOn(h, '2026-11-11')).toBe(true);
    expect(isScheduledOn(h, '2026-11-12')).toBe(false);
    expect(isScheduledOn(h, '2026-09-30')).toBe(false);
  });

  test('every N days counts from the start date', () => {
    const h = habit({ scheduleType: 'interval', intervalDays: 3, weekdays: [], startDate: '2026-11-01' });
    expect(['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10'].every((d) => isScheduledOn(h, d))).toBe(true);
    expect(isScheduledOn(h, '2026-11-02')).toBe(false);
    expect(isScheduledOn(h, '2026-10-29')).toBe(false);
  });

  test('monthly lands on the day, or the last day of a short month', () => {
    const h = habit({ scheduleType: 'monthly_day', monthDay: 31, weekdays: [], startDate: '2026-01-01' });
    expect(isScheduledOn(h, '2026-02-28')).toBe(true);
    expect(isScheduledOn(h, '2026-02-27')).toBe(false);
    expect(isScheduledOn(h, '2026-03-31')).toBe(true);
    expect(isScheduledOn(h, '2026-04-30')).toBe(true);
  });
});

describe('windows', () => {
  test('a weekly window runs Monday to Sunday and starts no earlier than the habit', () => {
    const h = habit({ scheduleType: 'weekly_count', weeklyTarget: 3, weekdays: [], startDate: '2026-11-11' });
    expect(windowFor(h, '2026-11-13')).toEqual({ start: '2026-11-11', endExclusive: '2026-11-16', quota: 3 });
    expect(windowFor(h, '2026-11-17')).toEqual({ start: '2026-11-16', endExclusive: '2026-11-23', quota: 3 });
    expect(windowFor(h, '2026-11-10')).toBeNull();
  });

  test('an interval window is N days long', () => {
    const h = habit({ scheduleType: 'interval', intervalDays: 3, weekdays: [], startDate: '2026-11-01' });
    expect(windowFor(h, '2026-11-05')).toEqual({ start: '2026-11-04', endExclusive: '2026-11-07', quota: 1 });
    expect(windowFor(h, '2026-11-01')).toEqual({ start: '2026-11-01', endExclusive: '2026-11-04', quota: 1 });
  });

  test('a monthly window runs from one monthly date to the next, including short months', () => {
    const h = habit({ scheduleType: 'monthly_day', monthDay: 31, weekdays: [], startDate: '2026-01-01' });
    expect(windowFor(h, '2026-03-05')).toEqual({ start: '2026-02-28', endExclusive: '2026-03-31', quota: 1 });
    expect(windowFor(h, '2026-03-31')).toEqual({ start: '2026-03-31', endExclusive: '2026-04-30', quota: 1 });
    expect(windowFor(h, '2026-01-15')).toBeNull();
  });

  test('windows listed up to today, oldest first', () => {
    const h = habit({ scheduleType: 'interval', intervalDays: 5, weekdays: [], startDate: '2026-11-01' });
    expect(listWindows(h, TODAY).map((w) => w.start)).toEqual(['2026-11-01', '2026-11-06', '2026-11-11']);
    expect(listWindows(habit({ startDate: '2026-12-01', scheduleType: 'interval', intervalDays: 2 }), TODAY)).toEqual([]);
    expect(listWindows(habit(), TODAY)).toEqual([]);
  });

  test('countInRange is half-open', () => {
    expect(countInRange(set('2026-11-09', '2026-11-12', '2026-11-16'), '2026-11-09', '2026-11-16')).toBe(2);
  });
});

describe('dueInfo (what stays on Today)', () => {
  const weekly = habit({ scheduleType: 'weekly_count', weeklyTarget: 3, weekdays: [] });

  test('a times-a-week habit is listed until the week is met', () => {
    expect(dueInfo(weekly, '2026-11-11', set())).toEqual({ due: true, note: '0 of 3 this week' });
    expect(dueInfo(weekly, '2026-11-11', set('2026-11-09'))).toEqual({ due: true, note: '1 of 3 this week' });
    expect(dueInfo(weekly, '2026-11-11', set('2026-11-09', '2026-11-10'))).toEqual({ due: true, note: '2 of 3 this week' });
  });

  test('it disappears once met, but stays visible on the day it was finished', () => {
    const done = set('2026-11-09', '2026-11-10', '2026-11-11');
    expect(dueInfo(weekly, '2026-11-11', done)).toEqual({ due: true, note: '3 of 3 this week' });
    expect(dueInfo(weekly, '2026-11-12', done).due).toBe(false);
    expect(dueInfo(weekly, '2026-11-16', done).due).toBe(true);
  });

  test('an every-few-days habit stays until done, with a note saying since when', () => {
    const h = habit({ scheduleType: 'interval', intervalDays: 3, weekdays: [], startDate: '2026-11-01' });
    expect(dueInfo(h, '2026-11-04', set()).due).toBe(true);
    expect(dueInfo(h, '2026-11-04', set()).note).toBeNull();
    const late = dueInfo(h, '2026-11-06', set());
    expect(late.due).toBe(true);
    expect(late.note).toMatch(/^Since /);
    expect(dueInfo(h, '2026-11-06', set('2026-11-05')).due).toBe(false);
    expect(dueInfo(h, '2026-11-07', set('2026-11-05')).due).toBe(true);
  });

  test('a monthly habit is not listed before its first date', () => {
    const h = habit({ scheduleType: 'monthly_day', monthDay: 20, weekdays: [], startDate: '2026-11-01' });
    expect(dueInfo(h, '2026-11-11', set()).due).toBe(false);
    expect(dueInfo(h, '2026-11-20', set()).due).toBe(true);
    expect(dueInfo(h, '2026-11-25', set()).due).toBe(true);
    expect(dueInfo(h, '2026-11-25', set('2026-11-22')).due).toBe(false);
  });

  test('nothing is due before the start date', () => {
    expect(dueInfo(habit({ startDate: '2026-12-01', scheduleType: 'weekly_count', weeklyTarget: 2 }), TODAY, set()).due).toBe(false);
  });
});

describe('streaks in their own unit', () => {
  test('weekly streak counts met weeks and an unfinished current week never breaks it', () => {
    const h = habit({ scheduleType: 'weekly_count', weeklyTarget: 2, weekdays: [], startDate: '2026-10-19' });
    const done = set('2026-10-19', '2026-10-22', '2026-10-27', '2026-10-30', '2026-11-03', '2026-11-05');
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 3, best: 3 });
    expect(computeStreaks(h, set('2026-11-09', '2026-11-10', ...done), TODAY)).toEqual({ current: 4, best: 4 });
  });

  test('a missed week resets the run but keeps the best', () => {
    // Weeks of 5, 12 and 19 Oct are met (best 3), 26 Oct is missed, 2 Nov is met, and the open week of 9 Nov is empty.
    const h = habit({ scheduleType: 'weekly_count', weeklyTarget: 2, weekdays: [], startDate: '2026-10-05' });
    const done = set('2026-10-05', '2026-10-06', '2026-10-12', '2026-10-13', '2026-10-19', '2026-10-20', '2026-11-02', '2026-11-03');
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 1, best: 3 });
  });

  test('every-few-days streak counts consecutive met periods', () => {
    const h = habit({ scheduleType: 'interval', intervalDays: 3, weekdays: [], startDate: '2026-11-01' });
    const done = set('2026-11-02', '2026-11-04', '2026-11-08');
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 3, best: 3 });
    expect(computeStreaks(h, set('2026-11-02', '2026-11-08'), TODAY)).toEqual({ current: 1, best: 1 });
  });

  test('a monthly streak counts months', () => {
    const h = habit({ scheduleType: 'monthly_day', monthDay: 5, weekdays: [], startDate: '2026-08-01' });
    const done = set('2026-09-06', '2026-10-05', '2026-11-05');
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 3, best: 3 });
    expect(computeStreaks(h, set('2026-11-05'), TODAY)).toEqual({ current: 1, best: 1 });
  });

  test('an unmet current window does not reset the run', () => {
    const h = habit({ scheduleType: 'monthly_day', monthDay: 5, weekdays: [], startDate: '2026-08-01' });
    expect(computeStreaks(h, set('2026-09-05', '2026-10-05'), '2026-11-06')).toEqual({ current: 2, best: 2 });
    expect(computeStreaks(h, set('2026-09-05', '2026-10-05'), '2026-12-06')).toEqual({ current: 0, best: 2 });
  });

  test('weekday streaks still behave as before', () => {
    // Mon-Fri habit: the first week was missed, then 9, 10 and 11 Nov (today) were done.
    const h = habit({ weekdays: [1, 2, 3, 4, 5], startDate: '2026-11-02' });
    expect(computeStreaks(h, set('2026-11-09', '2026-11-10', '2026-11-11'), TODAY)).toEqual({ current: 3, best: 3 });
    expect(computeStreaks(h, set('2026-11-09', '2026-11-10'), TODAY)).toEqual({ current: 2, best: 2 });
  });

  test('the overall day streak ignores flexible habits', () => {
    const flexible = habit({ id: 'f', scheduleType: 'weekly_count', weeklyTarget: 3, weekdays: [] });
    const daily = habit({ id: 'd', startDate: '2026-11-09' });
    const done = new Map([['d', set('2026-11-09', '2026-11-10')], ['f', set('2026-11-03')]]);
    expect(overallStreak([flexible, daily], done, TODAY)).toBe(2);
    expect(overallStreak([flexible], done, TODAY)).toBe(0);
  });

  test('weekly progress includes flexible habits', () => {
    const weekly = habit({ id: 'w', scheduleType: 'weekly_count', weeklyTarget: 3, weekdays: [] });
    const interval = habit({ id: 'i', scheduleType: 'interval', intervalDays: 2, weekdays: [], startDate: '2026-11-09' });
    const done = new Map([['w', set('2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12')], ['i', set('2026-11-09')]]);
    const p = weeklyProgress([weekly, interval], done, TODAY);
    // weekly: 3 scheduled / 3 done (capped). interval windows starting this week: 09, 11 -> 2 scheduled, 1 met.
    expect(p).toMatchObject({ scheduled: 5, completed: 4, percent: 80 });
  });
});

describe('migration 011', () => {
  test('existing habits upgrade as weekday habits with their schedule and logs intact', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations.slice(0, 10));
    await db.runAsync(
      "INSERT INTO habits (id, name, start_date, created_at, updated_at) VALUES ('old', 'Walk', '2026-10-01', 'n', 'n')",
    );
    await db.runAsync("INSERT INTO habit_schedule_days VALUES ('old', 1), ('old', 3)");
    await db.runAsync("INSERT INTO habit_logs (id, habit_id, log_date, created_at, updated_at) VALUES ('l1', 'old', '2026-11-02', 'n', 'n')");

    const applied = await runMigrations(db, migrations);
    expect(applied[0]).toBe(11);

    const row = await db.getFirstAsync("SELECT * FROM habits WHERE id = 'old'");
    expect(row).toMatchObject({ schedule_type: 'weekdays', interval_days: null, weekly_target: null, month_day: null });
    expect(await db.getAllAsync('SELECT weekday FROM habit_schedule_days ORDER BY weekday')).toEqual([{ weekday: 1 }, { weekday: 3 }]);
    expect((await db.getAllAsync('SELECT * FROM habit_logs')).length).toBe(1);
    expect(await dueNames(db, '2026-11-11')).toEqual(['Walk']);
  });

  test('constraints tie each type to its setting', async () => {
    const db = await freshDb();
    const insert = (cols, vals) =>
      db.runAsync(
        `INSERT INTO habits (id, name, start_date, created_at, updated_at, ${cols.join(', ')}) VALUES (?, 'x', '2026-11-01', 'n', 'n', ${cols.map(() => '?').join(', ')})`,
        [`id${Math.random()}`, ...vals],
      );
    await insert(['schedule_type', 'interval_days'], ['interval', 3]);
    await insert(['schedule_type', 'weekly_target'], ['weekly_count', 4]);
    await insert(['schedule_type', 'month_day'], ['monthly_day', 15]);
    await expect(insert(['schedule_type'], ['interval'])).rejects.toThrow();
    await expect(insert(['schedule_type', 'interval_days'], ['interval', 1])).rejects.toThrow();
    await expect(insert(['schedule_type', 'weekly_target'], ['weekly_count', 7])).rejects.toThrow();
    await expect(insert(['schedule_type', 'month_day'], ['monthly_day', 32])).rejects.toThrow();
    await expect(insert(['schedule_type', 'interval_days'], ['weekdays', 3])).rejects.toThrow();
    await expect(insert(['schedule_type'], ['hourly'])).rejects.toThrow();
  });
});

describe('creating and editing flexible habits', () => {
  test('a times-a-week habit has no weekday rows and appears every day until met', async () => {
    const db = await freshDb();
    await make(db, { scheduleType: 'weekly_count', weeklyTarget: 2 });
    const id = await idOf(db);
    expect(await db.getAllAsync('SELECT * FROM habit_schedule_days WHERE habit_id = ?', [id])).toEqual([]);
    expect(await dueNames(db, '2026-11-09')).toEqual(['Read']);

    await advanceHabit(db, id, '2026-11-09');
    const afterOne = (await getHabitsForDate(db, '2026-11-10'))[0];
    expect(afterOne.note).toBe('1 of 2 this week');

    await advanceHabit(db, id, '2026-11-10');
    expect(await dueNames(db, '2026-11-11')).toEqual([]);
    expect(await dueNames(db, '2026-11-16')).toEqual(['Read']);
  });

  test('the day it is finished it still shows as complete', async () => {
    const db = await freshDb();
    await make(db, { scheduleType: 'weekly_count', weeklyTarget: 1 });
    const id = await idOf(db);
    await advanceHabit(db, id, TODAY);
    const [today] = await getHabitsForDate(db, TODAY);
    expect(today).toMatchObject({ name: 'Read', complete: true, note: '1 of 1 this week' });
    expect(await dueNames(db, '2026-11-12')).toEqual([]);
  });

  test('an every-3-days habit stays listed until it is done', async () => {
    const db = await freshDb();
    await make(db, { scheduleType: 'interval', intervalDays: 3, startDate: '2026-11-01' });
    expect(await dueNames(db, '2026-11-01')).toEqual(['Read']);
    expect(await dueNames(db, '2026-11-03')).toEqual(['Read']);
    await advanceHabit(db, await idOf(db), '2026-11-03');
    expect(await dueNames(db, '2026-11-04')).toEqual(['Read']);
    expect(await dueNames(db, '2026-11-05')).toEqual(['Read']);
  });

  test('a monthly habit appears from its day and clears when done', async () => {
    const db = await freshDb();
    await make(db, { scheduleType: 'monthly_day', monthDay: 20, startDate: '2026-10-01' });
    expect(await dueNames(db, '2026-10-19')).toEqual([]);
    expect(await dueNames(db, '2026-10-20')).toEqual(['Read']);
    await advanceHabit(db, await idOf(db), '2026-10-22');
    expect(await dueNames(db, '2026-10-23')).toEqual([]);
    expect(await dueNames(db, '2026-11-19')).toEqual([]);
    expect(await dueNames(db, '2026-11-20')).toEqual(['Read']);
  });

  test('archived habits never appear', async () => {
    const db = await freshDb();
    await make(db, { scheduleType: 'weekly_count', weeklyTarget: 2 });
    await db.runAsync('UPDATE habits SET archived = 1');
    expect(await dueNames(db, TODAY)).toEqual([]);
  });

  test('validation messages are readable and nothing is written on failure', async () => {
    const db = await freshDb();
    await expect(make(db, { scheduleType: 'hourly' })).rejects.toThrow('how often');
    await expect(make(db, { scheduleType: 'interval', intervalDays: 1 })).rejects.toThrow('every 2');
    await expect(make(db, { scheduleType: 'interval', intervalDays: 400 })).rejects.toThrow('every 365');
    await expect(make(db, { scheduleType: 'interval' })).rejects.toThrow('every 2');
    await expect(make(db, { scheduleType: 'weekly_count', weeklyTarget: 7 })).rejects.toThrow('days of the week');
    await expect(make(db, { scheduleType: 'weekly_count', weeklyTarget: 0 })).rejects.toThrow('times a week');
    await expect(make(db, { scheduleType: 'monthly_day', monthDay: 0 })).rejects.toThrow('1 to 31');
    await expect(make(db, { scheduleType: 'monthly_day', monthDay: 32 })).rejects.toThrow('1 to 31');
    await expect(make(db, { scheduleType: 'weekdays', weekdays: [] })).rejects.toThrow('at least one day');
    expect((await db.getAllAsync('SELECT id FROM habits')).length).toBe(0);
  });

  test('switching the schedule clears the old settings and keeps every log', async () => {
    const db = await freshDb();
    await make(db, { weekdays: [1, 3, 5] });
    const id = await idOf(db);
    await advanceHabit(db, id, '2026-11-09');

    const base = { name: 'Read', icon: 'sprout', color: 'accentSage', targetCount: 1 };
    await updateHabit(db, id, { ...base, scheduleType: 'interval', intervalDays: 4 });
    let row = await db.getFirstAsync('SELECT * FROM habits WHERE id = ?', [id]);
    expect(row).toMatchObject({ schedule_type: 'interval', interval_days: 4, weekly_target: null, month_day: null });
    expect(await db.getAllAsync('SELECT * FROM habit_schedule_days WHERE habit_id = ?', [id])).toEqual([]);

    await updateHabit(db, id, { ...base, scheduleType: 'weekly_count', weeklyTarget: 3 });
    row = await db.getFirstAsync('SELECT * FROM habits WHERE id = ?', [id]);
    expect(row).toMatchObject({ schedule_type: 'weekly_count', interval_days: null, weekly_target: 3 });

    await updateHabit(db, id, { ...base, scheduleType: 'weekdays', weekdays: [2, 4] });
    expect(await db.getAllAsync('SELECT weekday FROM habit_schedule_days WHERE habit_id = ? ORDER BY weekday', [id])).toEqual([{ weekday: 2 }, { weekday: 4 }]);
    expect((await db.getAllAsync('SELECT * FROM habit_logs WHERE habit_id = ?', [id])).length).toBe(1);
  });

  test('a failed edit leaves the habit exactly as it was', async () => {
    const db = await freshDb();
    await make(db, { weekdays: [1, 3] });
    const id = await idOf(db);
    await expect(
      updateHabit(db, id, { name: 'Read', icon: 'sprout', color: 'accentSage', targetCount: 1, scheduleType: 'interval', intervalDays: 1 }),
    ).rejects.toThrow();
    expect((await db.getFirstAsync('SELECT schedule_type FROM habits WHERE id = ?', [id])).schedule_type).toBe('weekdays');
    expect((await db.getAllAsync('SELECT * FROM habit_schedule_days WHERE habit_id = ?', [id])).length).toBe(2);
  });

  test('createHabit without a schedule still means every day', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Stretch', startDate: '2026-10-01' });
    expect((await db.getAllAsync('SELECT * FROM habit_schedule_days')).length).toBe(7);
  });
});

describe('overview', () => {
  test('streak units and the Today list reflect each schedule', async () => {
    const db = await freshDb();
    await make(db, { name: 'Gym', scheduleType: 'weekly_count', weeklyTarget: 1, startDate: '2026-10-19' });
    await make(db, { name: 'Rent check', scheduleType: 'monthly_day', monthDay: 5, startDate: '2026-09-01' });
    const gym = await idOf(db, 'Gym');
    const rent = await idOf(db, 'Rent check');
    for (const d of ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10']) await advanceHabit(db, gym, d);
    for (const d of ['2026-10-06', '2026-11-06']) await advanceHabit(db, rent, d);

    const overview = await loadHabitsOverview(db, TODAY);
    const byName = Object.fromEntries(overview.habits.map((h) => [h.name, h]));
    expect(byName.Gym).toMatchObject({ scheduleType: 'weekly_count', weeklyTarget: 1, streakUnit: 'week', currentStreak: 4 });
    expect(byName['Rent check']).toMatchObject({ scheduleType: 'monthly_day', monthDay: 5, streakUnit: 'month', currentStreak: 2, bestStreak: 2 });
    expect(overview.dueToday.map((h) => h.name)).toEqual([]);
    expect(overview.streakDays).toBe(0);
  });
});

describe('backup and restore', () => {
  const NOW = '2026-11-11T10:00:00.000Z';
  const roundTrip = async (source) => {
    const tables = await readAllTables(source);
    const doc = buildBackupDocument({ tables, schemaVersion: migrations.length, appVersion: '1.0.0', exportedAt: NOW });
    return validateBackupText(JSON.stringify(doc), { currentSchemaVersion: migrations.length }).doc;
  };

  test('flexible schedules survive a backup and restore', async () => {
    const source = await freshDb();
    await make(source, { name: 'Gym', scheduleType: 'weekly_count', weeklyTarget: 3 });
    await make(source, { name: 'Water plants', scheduleType: 'interval', intervalDays: 4 });
    await make(source, { name: 'Review', scheduleType: 'monthly_day', monthDay: 28 });
    const doc = await roundTrip(source);

    const target = await freshDb();
    await replaceAllTables(target, doc);
    const rows = await target.getAllAsync('SELECT name, schedule_type, interval_days, weekly_target, month_day FROM habits ORDER BY name');
    expect(rows).toEqual([
      { name: 'Gym', schedule_type: 'weekly_count', interval_days: null, weekly_target: 3, month_day: null },
      { name: 'Review', schedule_type: 'monthly_day', interval_days: null, weekly_target: null, month_day: 28 },
      { name: 'Water plants', schedule_type: 'interval', interval_days: 4, weekly_target: null, month_day: null },
    ]);
  });

  test('a backup made before flexible schedules restores its habits as weekday habits', async () => {
    const source = await freshDb();
    await make(source, { name: 'Walk', weekdays: [1, 3] });
    const doc = await roundTrip(source);
    for (const row of doc.tables.habits) {
      delete row.schedule_type;
      delete row.interval_days;
      delete row.weekly_target;
      delete row.month_day;
    }
    const older = validateBackupText(JSON.stringify(doc), { currentSchemaVersion: migrations.length }).doc;

    const target = await freshDb();
    await replaceAllTables(target, older);
    const row = await target.getFirstAsync("SELECT schedule_type FROM habits WHERE name = 'Walk'");
    expect(row.schedule_type).toBe('weekdays');
    expect(await dueNames(target, '2026-11-11')).toEqual(['Walk']);
  });

  test('a backup whose schedule does not match its settings is rejected and nothing changes', async () => {
    const source = await freshDb();
    await make(source, { name: 'Gym', scheduleType: 'weekly_count', weeklyTarget: 3 });
    const doc = await roundTrip(source);
    doc.tables.habits[0].weekly_target = null;

    const target = await freshDb();
    await make(target, { name: 'Keep me' });
    await expect(replaceAllTables(target, doc)).rejects.toThrow();
    expect((await target.getAllAsync('SELECT name FROM habits')).map((r) => r.name)).toEqual(['Keep me']);
  });
});
