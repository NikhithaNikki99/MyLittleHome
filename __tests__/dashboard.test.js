import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { setSetting } from '../src/database/repositories/settingsRepository';
import { loadDashboard } from '../src/features/dashboard/dashboardService';
import { addTransaction } from '../src/features/expenses/expenseService';
import { advanceHabit, createHabit } from '../src/features/habits/habitService';
import { addTask, toggleTask } from '../src/features/planner/taskService';
import { addWater, addWeight, setMood } from '../src/features/wellness/wellnessService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

// Wednesday. weekdayOf('2026-11-11') === 3.
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('empty database', () => {
  test('shows honest zeros and nulls, never demo data', async () => {
    const db = await freshDb();
    const d = await loadDashboard(db, TODAY);

    expect(d.mood).toBeNull();
    expect(d.weight).toBeNull();
    expect(d.water).toEqual({ totalMl: 0, goalMl: 2000 });
    expect(d.spending).toEqual({ todayPaise: 0, todayCount: 0, monthExpensePaise: 0, monthIncomePaise: 0 });
    expect(d.habits).toEqual({ items: [], dueCount: 0, completedCount: 0 });
    expect(d.tasks).toEqual([]);
    expect(typeof d.quote).toBe('string');
  });
});

describe('mood', () => {
  test('re-checking in the same day updates the single row', async () => {
    const db = await freshDb();
    await setMood(db, { mood: 2, logDate: TODAY });
    await setMood(db, { mood: 5, logDate: TODAY });
    expect((await loadDashboard(db, TODAY)).mood).toBe(5);
    expect((await db.getAllAsync('SELECT * FROM mood_logs')).length).toBe(1);
  });

  test('rejects values outside 1-5', async () => {
    const db = await freshDb();
    await expect(setMood(db, { mood: 0 })).rejects.toThrow(/1 to 5/);
    await expect(setMood(db, { mood: 2.5 })).rejects.toThrow(/1 to 5/);
  });
});

describe('water', () => {
  test('sums only today and honours a custom goal', async () => {
    const db = await freshDb();
    await setSetting(db, 'water_goal_ml', 2500);
    await addWater(db, { amountMl: 250, logDate: TODAY });
    await addWater(db, { amountMl: 500, logDate: TODAY });
    await addWater(db, { amountMl: 750, logDate: '2026-11-10' });

    expect((await loadDashboard(db, TODAY)).water).toEqual({ totalMl: 750, goalMl: 2500 });
  });

  test('falls back to the default goal when the stored one is garbage', async () => {
    const db = await freshDb();
    await setSetting(db, 'water_goal_ml', 'lots');
    expect((await loadDashboard(db, TODAY)).water.goalMl).toBe(2000);
  });

  test('rejects zero, negative and absurd amounts', async () => {
    const db = await freshDb();
    for (const bad of [0, -100, 5001, 12.5, '250']) {
      await expect(addWater(db, { amountMl: bad })).rejects.toThrow();
    }
  });
});

describe('weight', () => {
  test('latest entry wins by date, then by entry time; previous is the one before it', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 64.0, entryDate: '2026-11-01' });
    await addWeight(db, { weightKg: 63.4, entryDate: '2026-11-08' });
    await addWeight(db, { weightKg: 99.0, entryDate: '2026-10-01' }); // back-dated entry must not become "latest"

    const w = (await loadDashboard(db, TODAY)).weight;
    expect(w).toEqual({ kg: 63.4, date: '2026-11-08', previousKg: 64.0 });
  });

  test('a single entry has no previous value to compare', async () => {
    const db = await freshDb();
    await addWeight(db, { weightKg: 60, entryDate: TODAY });
    expect((await loadDashboard(db, TODAY)).weight).toEqual({ kg: 60, date: TODAY, previousKg: null });
  });

  test('rejects implausible weights', async () => {
    const db = await freshDb();
    for (const bad of [0, 19, 301, NaN, '60']) {
      await expect(addWeight(db, { weightKg: bad })).rejects.toThrow(/between/);
    }
  });
});

describe('spending', () => {
  test('separates today from the month, and expenses from income, in integer paise', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: 'Lunch', amountPaise: 25050, categoryId: 'cat-food', txnDate: TODAY });
    await addTransaction(db, { title: 'Bus', amountPaise: 4000, categoryId: 'cat-travel', txnDate: TODAY });
    await addTransaction(db, { title: 'Groceries', amountPaise: 100000, categoryId: 'cat-food', txnDate: '2026-11-03' });
    await addTransaction(db, { kind: 'income', title: 'Salary', amountPaise: 5000000, categoryId: 'cat-other', txnDate: '2026-11-01' });

    expect((await loadDashboard(db, TODAY)).spending).toEqual({
      todayPaise: 29050,
      todayCount: 2,
      monthExpensePaise: 129050,
      monthIncomePaise: 5000000,
    });
  });

  test('month boundaries are exact: last day of previous month and first of next are excluded', async () => {
    const db = await freshDb();
    await addTransaction(db, { title: 'Oct 31', amountPaise: 1000, categoryId: 'cat-other', txnDate: '2026-10-31' });
    await addTransaction(db, { title: 'Nov 1', amountPaise: 2000, categoryId: 'cat-other', txnDate: '2026-11-01' });
    await addTransaction(db, { title: 'Nov 30', amountPaise: 3000, categoryId: 'cat-other', txnDate: '2026-11-30' });
    await addTransaction(db, { title: 'Dec 1', amountPaise: 4000, categoryId: 'cat-other', txnDate: '2026-12-01' });

    expect((await loadDashboard(db, TODAY)).spending.monthExpensePaise).toBe(5000);
    expect((await loadDashboard(db, '2026-12-15')).spending.monthExpensePaise).toBe(4000);
  });

  test('validates input before writing', async () => {
    const db = await freshDb();
    const ok = { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food' };
    await expect(addTransaction(db, { ...ok, title: '   ' })).rejects.toThrow(/title/);
    await expect(addTransaction(db, { ...ok, amountPaise: 0 })).rejects.toThrow(/above zero/);
    await expect(addTransaction(db, { ...ok, amountPaise: 12.5 })).rejects.toThrow(/above zero/);
    await expect(addTransaction(db, { ...ok, categoryId: 'nope' })).rejects.toThrow(/category/);
    await expect(addTransaction(db, { ...ok, categoryId: undefined })).rejects.toThrow(/category/);
    await expect(addTransaction(db, { ...ok, txnDate: '2026-02-30' })).rejects.toThrow(/date/);
    expect(await db.getAllAsync('SELECT * FROM transactions')).toEqual([]);
  });
});

describe('habits', () => {
  test('only habits scheduled on today (and already started) are due', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Daily stretch', startDate: '2026-11-01' });
    await createHabit(db, { name: 'Wednesday class', weekdays: [3], startDate: '2026-11-01' });
    await createHabit(db, { name: 'Monday run', weekdays: [1], startDate: '2026-11-01' });
    await createHabit(db, { name: 'Starts tomorrow', startDate: '2026-11-12' });

    const names = (await loadDashboard(db, TODAY)).habits.items.map((h) => h.name).sort();
    expect(names).toEqual(['Daily stretch', 'Wednesday class']);
  });

  test('a single-target habit toggles on and off', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Read', startDate: TODAY });
    const id = (await loadDashboard(db, TODAY)).habits.items[0].id;

    await advanceHabit(db, id, TODAY);
    let h = (await loadDashboard(db, TODAY)).habits;
    expect([h.completedCount, h.dueCount]).toEqual([1, 1]);

    await advanceHabit(db, id, TODAY);
    h = (await loadDashboard(db, TODAY)).habits;
    expect([h.completedCount, h.dueCount]).toEqual([0, 1]);
    expect(await db.getAllAsync('SELECT * FROM habit_logs')).toEqual([]);
  });

  test('a multi-target habit steps up to its target and then wraps back to zero', async () => {
    const db = await freshDb();
    await createHabit(db, { name: 'Glasses of water', targetCount: 3, startDate: TODAY });
    const id = (await loadDashboard(db, TODAY)).habits.items[0].id;
    const state = async () => {
      const item = (await loadDashboard(db, TODAY)).habits.items[0];
      return [item.doneCount, item.complete];
    };

    await advanceHabit(db, id, TODAY);
    expect(await state()).toEqual([1, false]);
    await advanceHabit(db, id, TODAY);
    expect(await state()).toEqual([2, false]);
    await advanceHabit(db, id, TODAY);
    expect(await state()).toEqual([3, true]);
    await advanceHabit(db, id, TODAY);
    expect(await state()).toEqual([0, false]);
  });

  test('validates habit input and a missing habit', async () => {
    const db = await freshDb();
    await expect(createHabit(db, { name: '  ' })).rejects.toThrow(/name/);
    await expect(createHabit(db, { name: 'X', weekdays: [] })).rejects.toThrow(/day/);
    await expect(createHabit(db, { name: 'X', weekdays: [7] })).rejects.toThrow(/day/);
    await expect(createHabit(db, { name: 'X', targetCount: 0 })).rejects.toThrow(/Target/);
    await expect(advanceHabit(db, 'ghost', TODAY)).rejects.toThrow(/no longer available/);
  });

  test('a failed habit creation leaves no half-written habit behind', async () => {
    const db = await freshDb();
    await db.execAsync('CREATE TRIGGER fail_schedule BEFORE INSERT ON habit_schedule_days BEGIN SELECT RAISE(ABORT, \'boom\'); END;');
    await expect(createHabit(db, { name: 'Walk', startDate: TODAY })).rejects.toThrow(/boom/);
    expect(await db.getAllAsync('SELECT * FROM habits')).toEqual([]);
  });
});

describe('tasks', () => {
  test('shows overdue and due-today open tasks; hides future and undated; keeps ones finished today', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Overdue', dueDate: '2026-11-09', priority: 2 });
    await addTask(db, { title: 'Due today', dueDate: TODAY, priority: 1 });
    await addTask(db, { title: 'Next week', dueDate: '2026-11-18' });
    await addTask(db, { title: 'Someday', dueDate: null });

    const titles = (await loadDashboard(db, TODAY)).tasks.map((t) => t.title);
    expect(titles).toEqual(['Due today', 'Overdue']);

    const overdue = (await loadDashboard(db, TODAY)).tasks.find((t) => t.title === 'Overdue');
    expect(overdue.overdue).toBe(true);
  });

  test('completing keeps the task visible (done, sorted last); un-completing restores it', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Call mum', dueDate: TODAY });
    await addTask(db, { title: 'Pay rent', dueDate: TODAY });
    const call = (await loadDashboard(db, TODAY)).tasks.find((t) => t.title === 'Call mum');

    await toggleTask(db, call.id);
    let tasks = (await loadDashboard(db, TODAY)).tasks;
    expect(tasks.map((t) => [t.title, t.done])).toEqual([['Pay rent', false], ['Call mum', true]]);

    await toggleTask(db, call.id);
    tasks = (await loadDashboard(db, TODAY)).tasks;
    expect(tasks.every((t) => !t.done)).toBe(true);
  });

  test('validates task input', async () => {
    const db = await freshDb();
    await expect(addTask(db, { title: '' })).rejects.toThrow(/title/);
    await expect(addTask(db, { title: 'X', priority: 7 })).rejects.toThrow(/Priority/);
    await expect(addTask(db, { title: 'X', dueDate: 'tomorrow' })).rejects.toThrow(/date/);
    await expect(toggleTask(db, 'ghost')).rejects.toThrow(/no longer exists/);
  });
});
