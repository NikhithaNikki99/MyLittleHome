import {
  computeStreaks,
  gardenStage,
  groupCompletedDays,
  isScheduledOn,
  listDays,
  overallStreak,
  weekStartOf,
  weeklyProgress,
} from '../src/features/habits/habitStats';
import { describeSchedule } from '../src/features/habits/habitOptions';

// 2026-11-11 is a Wednesday (weekday 3). Weeks run Monday to Sunday: this week starts 2026-11-09.
const TODAY = '2026-11-11';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const habit = (over = {}) => ({ id: 'h1', startDate: '2026-01-01', weekdays: EVERY_DAY, ...over });
const days = (...keys) => new Set(keys);

describe('listDays', () => {
  test('is inclusive, oldest first, and crosses month and year ends', () => {
    expect(listDays('2026-12-30', '2027-01-02').map((d) => d.key)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  test('returns nothing when start is after end', () => {
    expect(listDays('2026-11-12', '2026-11-11')).toEqual([]);
  });

  test('steps one calendar day at a time across US DST changes (meaningful when run with TZ=America/New_York)', () => {
    const keys = listDays('2026-10-30', '2026-11-03').map((d) => d.key);
    expect(keys).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    expect(listDays('2026-03-07', '2026-03-10').map((d) => d.key)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });

  test('reports the right weekday for each key', () => {
    expect(listDays('2026-11-08', '2026-11-14').map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('isScheduledOn', () => {
  test('requires both the weekday and that the habit has started', () => {
    const h = habit({ weekdays: [3], startDate: '2026-11-11' });
    expect(isScheduledOn(h, '2026-11-11')).toBe(true);
    expect(isScheduledOn(h, '2026-11-04')).toBe(false); // Wednesday, but before the start date
    expect(isScheduledOn(h, '2026-11-12')).toBe(false); // wrong weekday
  });
});

describe('computeStreaks', () => {
  test('counts consecutive completed days ending today', () => {
    const done = days('2026-11-09', '2026-11-10', '2026-11-11');
    expect(computeStreaks(habit(), done, TODAY)).toEqual({ current: 3, best: 3 });
  });

  test('an incomplete today does not break a streak that ended yesterday', () => {
    const done = days('2026-11-08', '2026-11-09', '2026-11-10');
    expect(computeStreaks(habit(), done, TODAY)).toEqual({ current: 3, best: 3 });
  });

  test('a fully skipped day before today resets the current run but keeps the best', () => {
    const done = days('2026-11-05', '2026-11-06', '2026-11-07', '2026-11-10');
    expect(computeStreaks(habit(), done, TODAY)).toEqual({ current: 1, best: 3 });
  });

  test('nothing logged is zero', () => {
    expect(computeStreaks(habit(), days(), TODAY)).toEqual({ current: 0, best: 0 });
  });

  test('only counts days on or after the start date', () => {
    const done = days('2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11');
    expect(computeStreaks(habit({ startDate: '2026-11-10' }), done, TODAY).current).toBe(2);
  });

  test('a Mon/Wed/Fri habit skips unscheduled days without breaking the run', () => {
    const h = habit({ weekdays: [1, 3, 5] });
    // Fri 6th, Mon 9th and Wed 11th done; Tue 10th is not scheduled.
    const done = days('2026-11-06', '2026-11-09', '2026-11-11');
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 3, best: 3 });
  });

  test('a Mon/Wed/Fri habit loses the run when a scheduled day passes without completion', () => {
    const h = habit({ weekdays: [1, 3, 5] });
    const done = days('2026-11-04', '2026-11-11'); // Wed 4th, then nothing Fri 6th or Mon 9th, then Wed 11th
    expect(computeStreaks(h, done, TODAY)).toEqual({ current: 1, best: 1 });
  });

  test('completions on unscheduled days are ignored', () => {
    const h = habit({ weekdays: [1] });
    expect(computeStreaks(h, days('2026-11-10', '2026-11-11'), TODAY)).toEqual({ current: 0, best: 0 });
  });

  test('a run that crosses a month and a year boundary keeps counting', () => {
    const done = days('2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02');
    expect(computeStreaks(habit(), done, '2027-01-02')).toEqual({ current: 4, best: 4 });
  });

  test('a run that crosses a DST change keeps counting', () => {
    const done = days('2026-10-31', '2026-11-01', '2026-11-02');
    expect(computeStreaks(habit(), done, '2026-11-02')).toEqual({ current: 3, best: 3 });
  });

  test('a habit that starts in the future has no streak', () => {
    expect(computeStreaks(habit({ startDate: '2026-11-20' }), days('2026-11-11'), TODAY)).toEqual({
      current: 0,
      best: 0,
    });
  });
});

describe('overallStreak', () => {
  const a = habit({ id: 'a' });
  const b = habit({ id: 'b', weekdays: [1] }); // Mondays only

  test('is zero without habits', () => {
    expect(overallStreak([], new Map(), TODAY)).toBe(0);
  });

  test('counts days on which at least one scheduled habit was completed', () => {
    const map = new Map([['a', days('2026-11-09', '2026-11-10')]]);
    expect(overallStreak([a, b], map, TODAY)).toBe(2);
  });

  test('a day with nothing scheduled neither counts nor breaks the run', () => {
    const onlyMondays = [b];
    const map = new Map([['b', days('2026-11-02', '2026-11-09')]]);
    expect(overallStreak(onlyMondays, map, TODAY)).toBe(2);
  });

  test('today being empty does not break the run', () => {
    const map = new Map([['a', days('2026-11-09', '2026-11-10')]]);
    expect(overallStreak([a], map, TODAY)).toBe(2);
  });

  test('a past day with scheduled habits and no completions resets it', () => {
    const map = new Map([['a', days('2026-11-07', '2026-11-10')]]);
    expect(overallStreak([a], map, TODAY)).toBe(1);
  });
});

describe('weekStartOf and weeklyProgress', () => {
  test('weeks start on Monday, including when today is Sunday or Monday', () => {
    expect(weekStartOf('2026-11-11')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
  });

  test('week start crosses month and year boundaries', () => {
    expect(weekStartOf('2026-12-02')).toBe('2026-11-30');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });

  test('is completed over scheduled so far this week, today included', () => {
    const map = new Map([['h1', days('2026-11-09', '2026-11-10')]]);
    // Mon, Tue, Wed scheduled so far: 2 of 3 done.
    expect(weeklyProgress([habit()], map, TODAY)).toEqual({
      weekStart: '2026-11-09',
      scheduled: 3,
      completed: 2,
      percent: 67,
    });
  });

  test('ignores days earlier than the habit start date and unscheduled weekdays', () => {
    const h = habit({ startDate: '2026-11-10', weekdays: [1, 2, 3] });
    const map = new Map([['h1', days('2026-11-10')]]);
    // Monday is before the start, so only Tue and Wed are scheduled.
    expect(weeklyProgress([h], map, TODAY)).toMatchObject({ scheduled: 2, completed: 1, percent: 50 });
  });

  test('is 0% (not NaN) when nothing is scheduled', () => {
    expect(weeklyProgress([], new Map(), TODAY)).toMatchObject({ scheduled: 0, completed: 0, percent: 0 });
    const future = habit({ startDate: '2026-12-01' });
    expect(weeklyProgress([future], new Map(), TODAY).percent).toBe(0);
  });

  test('combines several habits', () => {
    const map = new Map([
      ['a', days('2026-11-09', '2026-11-10', '2026-11-11')],
      ['b', days()],
    ]);
    const a = habit({ id: 'a' });
    const b = habit({ id: 'b' });
    expect(weeklyProgress([a, b], map, TODAY)).toMatchObject({ scheduled: 6, completed: 3, percent: 50 });
  });
});

describe('gardenStage', () => {
  test('grows with the best streak and never shrinks as the best only increases', () => {
    expect(gardenStage(0).key).toBe('seed');
    expect(gardenStage(1).key).toBe('sprout');
    expect(gardenStage(2).key).toBe('sprout');
    expect(gardenStage(3).key).toBe('seedling');
    expect(gardenStage(7).key).toBe('bud');
    expect(gardenStage(14).key).toBe('bloom');
    expect(gardenStage(400).key).toBe('bloom');
  });

  test('a plant keeps its stage after a skipped day because it is based on the best run', () => {
    const done = days('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07');
    const { best, current } = computeStreaks(habit(), done, '2026-11-11');
    expect(current).toBe(0);
    expect(gardenStage(best).key).toBe('bud');
  });
});

describe('groupCompletedDays and describeSchedule', () => {
  test('groups rows per habit', () => {
    const map = groupCompletedDays([
      { habit_id: 'a', log_date: '2026-11-10' },
      { habit_id: 'a', log_date: '2026-11-11' },
      { habit_id: 'b', log_date: '2026-11-11' },
    ]);
    expect([...map.get('a')]).toEqual(['2026-11-10', '2026-11-11']);
    expect(map.get('b').size).toBe(1);
  });

  test('describes schedules in plain words', () => {
    expect(describeSchedule([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(describeSchedule([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeSchedule([6, 0])).toBe('Weekends');
    expect(describeSchedule([0, 3, 1])).toBe('Mon, Wed, Sun');
  });
});
