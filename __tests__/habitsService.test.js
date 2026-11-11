import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { loadHabitsOverview } from '../src/features/habits/habitOverview';
import {
  advanceHabit,
  createHabit,
  deleteHabit,
  getHabitsForDate,
  setHabitArchived,
  updateHabit,
} from '../src/features/habits/habitService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

// Wednesday. This week (Mon-Sun) starts 2026-11-09.
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

async function idOf(db, name) {
  return (await db.getFirstAsync('SELECT id FROM habits WHERE name = ?', [name])).id;
}

describe('create and validation', () => {
  test('stores icon, colour, target, schedule and start date', async () => {
    const db = await freshDb();
    await createHabit(db, {
      name: '  Read   a chapter ',
      icon: 'book-open',
      color: 'accentLavender',
      targetCount: 2,
      weekdays: [1, 3, 3, 5],
      startDate: '2026-11-02',
    });
    const o = await loadHabitsOverview(db, TODAY);
    expect(o.habits).toHaveLength(1);
    expect(o.habits[0]).toMatchObject({
      name: 'Read a chapter',
      icon: 'book-open',
      color: 'accentLavender',
      targetCount: 2,
      startDate: '2026-11-02',
      archived: false,
    });
    expect(o.habits[0].weekdays.sort()).toEqual([1, 3, 5]);
  });

  test('rejects bad input with friendly messages', async () => {
    const db = await freshDb();
    await expect(createHabit(db, { name: '   ' })).rejects.toThrow(/name/);
    await expect(createHabit(db, { name: 'x'.repeat(61) })).rejects.toThrow(/under 60/);
    await expect(createHabit(db, { name: 'X', targetCount: 0 })).rejects.toThrow(/Target/);
    await expect(createHabit(db, { name: 'X', targetCount: 101 })).rejects.toThrow(/Target/);
    await expect(createHabit(db, { name: 'X', targetCount: 1.5 })).rejects.toThrow(/Target/);
    await expect(createHabit(db, { name: 'X', weekdays: [] })).rejects.toThrow(/day/);
    await expect(createHabit(db, { name: 'X', weekdays: [-1] })).rejects.toThrow(/day/);
    await expect(createHabit(db, { name: 'X', icon: 'nope' })).rejects.toThrow(/icons/);
    await expect(createHabit(db, { name: 'X', color: '#ff0000' })).rejects.toThrow(/colours/);
    await expect(createHabit(db, { name: 'X', startDate: '2026-02-31' })).rejects.toThrow(/date/);
    expect(await db.getAllAsync('SELECT * FROM habits')).toEqual([]);
  });
});

describe('edit', () => {
  test('changes name, icon, colour, target and schedule, and keeps the logs', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Stretch', startDate: '2026-11-01' });
    const id = await idOf(db, 'Stretch');
    await advanceHabit(db, id, '2026-11-10');

    await updateHabit(db, id, {
      name: 'Evening stretch',
      icon: 'moon',
      color: 'accentBlue',
      targetCount: 1,
      weekdays: [1, 2],
    });

    const h = (await loadHabitsOverview(db, TODAY)).habits[0];
    expect(h).toMatchObject({ name: 'Evening stretch', icon: 'moon', color: 'accentBlue', targetCount: 1 });
    expect(h.weekdays.sort()).toEqual([1, 2]);
    expect(await db.getAllAsync('SELECT * FROM habit_logs')).toHaveLength(1);
  });

  test('lowering the target caps existing counts so a day never shows 3/2', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Water', targetCount: 4, startDate: '2026-11-01' });
    const id = await idOf(db, 'Water');
    for (let i = 0; i < 3; i += 1) await advanceHabit(db, id, TODAY);

    await updateHabit(db, id, { name: 'Water', icon: 'droplets', color: 'accentBlue', targetCount: 2, weekdays: [0, 1, 2, 3, 4, 5, 6] });

    const item = (await getHabitsForDate(db, TODAY))[0];
    expect(item).toMatchObject({ doneCount: 2, targetCount: 2, complete: true });
  });

  test('validation failures leave the habit untouched; a missing habit is reported', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Walk', startDate: '2026-11-01' });
    const id = await idOf(db, 'Walk');
    const valid = { name: 'Walk', icon: 'sprout', color: 'accentSage', targetCount: 1, weekdays: [1] };

    await expect(updateHabit(db, id, { ...valid, name: ' ' })).rejects.toThrow(/name/);
    await expect(updateHabit(db, id, { ...valid, weekdays: [] })).rejects.toThrow(/day/);
    await expect(updateHabit(db, 'ghost', valid)).rejects.toThrow(/no longer exists/);

    const days = await db.getAllAsync('SELECT weekday FROM habit_schedule_days WHERE habit_id = ?', [id]);
    expect(days).toHaveLength(7);
  });

  test('a failure while rewriting the schedule rolls the whole edit back', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Walk', startDate: '2026-11-01' });
    const id = await idOf(db, 'Walk');
    await db.execAsync(
      "CREATE TRIGGER fail_schedule BEFORE INSERT ON habit_schedule_days BEGIN SELECT RAISE(ABORT, 'boom'); END;",
    );

    await expect(
      updateHabit(db, id, { name: 'Renamed', icon: 'sprout', color: 'accentSage', targetCount: 1, weekdays: [1] }),
    ).rejects.toThrow(/boom/);

    expect((await db.getFirstAsync('SELECT name FROM habits WHERE id = ?', [id])).name).toBe('Walk');
    expect(await db.getAllAsync('SELECT * FROM habit_schedule_days WHERE habit_id = ?', [id])).toHaveLength(7);
  });
});

describe('archive and delete', () => {
  test('archiving hides the habit from Today, the garden and the weekly figure but keeps history', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Read', startDate: '2026-11-01' });
    const id = await idOf(db, 'Read');
    await advanceHabit(db, id, TODAY);

    await setHabitArchived(db, id, true);
    let o = await loadHabitsOverview(db, TODAY);
    expect(o.dueCount).toBe(0);
    expect(o.garden).toEqual([]);
    expect(o.weekPercent).toBe(0);
    expect(o.habits).toHaveLength(1);
    expect(o.habits[0].archived).toBe(true);
    await expect(advanceHabit(db, id, TODAY)).rejects.toThrow(/no longer available/);
    expect(await db.getAllAsync('SELECT * FROM habit_logs')).toHaveLength(1);

    await setHabitArchived(db, id, false);
    o = await loadHabitsOverview(db, TODAY);
    expect(o.dueCount).toBe(1);
    expect(o.completedCount).toBe(1);
  });

  test('deleting removes the habit, its schedule and its logs', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Read', startDate: '2026-11-01' });
    await createHabit(db, { name: 'Walk', startDate: '2026-11-01' });
    const id = await idOf(db, 'Read');
    await advanceHabit(db, id, TODAY);

    await deleteHabit(db, id);
    expect(await db.getAllAsync('SELECT name FROM habits')).toEqual([{ name: 'Walk' }]);
    expect(await db.getAllAsync('SELECT * FROM habit_logs')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM habit_schedule_days WHERE habit_id = ?', [id])).toEqual([]);
    await expect(deleteHabit(db, id)).rejects.toThrow(/no longer exists/);
    await expect(setHabitArchived(db, 'ghost', true)).rejects.toThrow(/no longer exists/);
  });
});

describe('overview figures', () => {
  test('progress ring, week percent and streak come from the logs', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Read', startDate: '2026-11-01' });
    await createHabit(db, { name: 'Walk', startDate: '2026-11-01' });
    const read = await idOf(db, 'Read');
    const walk = await idOf(db, 'Walk');
    // Read: Mon, Tue, Wed. Walk: Tue only.
    for (const d of ['2026-11-09', '2026-11-10', TODAY]) await advanceHabit(db, read, d);
    await advanceHabit(db, walk, '2026-11-10');

    const o = await loadHabitsOverview(db, TODAY);
    expect(o.dueCount).toBe(2);
    expect(o.completedCount).toBe(1); // only Read is done today
    expect(o.streakDays).toBe(3); // Mon, Tue, Wed each had at least one completion
    expect(o.weekPercent).toBe(67); // 4 of 6 habit-days so far this week
    const readStats = o.habits.find((h) => h.name === 'Read');
    expect(readStats).toMatchObject({ currentStreak: 3, bestStreak: 3 });
    expect(readStats.stage.key).toBe('seedling');
  });

  test('a multi-target habit only counts once its target is reached', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Water', targetCount: 3, startDate: '2026-11-01' });
    const id = await idOf(db, 'Water');
    await advanceHabit(db, id, TODAY);
    await advanceHabit(db, id, TODAY);

    let o = await loadHabitsOverview(db, TODAY);
    expect(o.completedCount).toBe(0);
    expect(o.habits[0].currentStreak).toBe(0);
    expect(o.streakDays).toBe(0);

    await advanceHabit(db, id, TODAY);
    o = await loadHabitsOverview(db, TODAY);
    expect(o.completedCount).toBe(1);
    expect(o.habits[0].currentStreak).toBe(1);
  });

  test('an empty database has honest zeros', async () => {
    const db = await freshDb();
    const o = await loadHabitsOverview(db, TODAY);
    expect(o).toMatchObject({ dueCount: 0, completedCount: 0, streakDays: 0, weekPercent: 0, habits: [], garden: [] });
  });

  test('a habit not scheduled today is listed but not due', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Mondays', weekdays: [1], startDate: '2026-11-01' });
    const o = await loadHabitsOverview(db, TODAY);
    expect(o.dueCount).toBe(0);
    expect(o.habits).toHaveLength(1);
    expect(o.garden).toHaveLength(1);
  });
});
