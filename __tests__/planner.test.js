import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import {
  addTask,
  deleteTask,
  getMonthTaskDays,
  getPlannerToday,
  getTaskForEdit,
  getTasksForDay,
  getTodayTasks,
  getWeekOverview,
  rescheduleTaskToTomorrow,
  toggleTask,
  updateTask,
} from '../src/features/planner/taskService';
import { formatWeekRange, selectionForMonth, weekDayKeys, weekStartOf } from '../src/features/planner/plannerDates';
import { addDays, parseDateKey } from '../src/utils/dates';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

// Wednesday.
const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

async function idOf(db, title) {
  return (await db.getFirstAsync('SELECT id FROM tasks WHERE title = ?', [title])).id;
}

// Local-day instants, the same way the service builds them (so tests do not depend on the machine's time zone).
const dayStart = (key) => parseDateKey(key).toISOString();
const noonOf = (key) => new Date(parseDateKey(key).getTime() + 12 * 3600 * 1000).toISOString();

describe('task validation', () => {
  test('rejects a blank title, a bad priority and an impossible date', async () => {
    const db = await freshDb();
    await expect(addTask(db, { title: '   ' })).rejects.toThrow(/task title/);
    await expect(addTask(db, { title: 'x', priority: 4 })).rejects.toThrow(/high, normal or low/);
    await expect(addTask(db, { title: 'x', dueDate: '2026-02-30' })).rejects.toThrow(/not valid/);
    await expect(addTask(db, { title: 'x', dueDate: 'tomorrow' })).rejects.toThrow(/not valid/);
    expect((await db.getAllAsync('SELECT id FROM tasks')).length).toBe(0);
  });

  test('trims the title and notes, and stores blank notes as null', async () => {
    const db = await freshDb();
    await addTask(db, { title: '  Call mum  ', description: '   ', dueDate: TODAY });
    await addTask(db, { title: 'Pay rent', description: ' before the 5th ', dueDate: TODAY });
    const call = await getTaskForEdit(db, await idOf(db, 'Call mum'));
    const rent = await getTaskForEdit(db, await idOf(db, 'Pay rent'));
    expect(call.description).toBeNull();
    expect(rent.description).toBe('before the 5th');
  });

  test('dueDate null makes a someday task', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Learn to bake', dueDate: null });
    expect((await getTaskForEdit(db, await idOf(db, 'Learn to bake'))).dueDate).toBeNull();
  });
});

describe('edit and delete', () => {
  test('updateTask changes every field and keeps completion state', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Draft', dueDate: TODAY, priority: 3 });
    const id = await idOf(db, 'Draft');
    await toggleTask(db, id);
    await updateTask(db, id, { title: 'Final', description: 'note', dueDate: '2026-11-20', priority: 1 });

    const t = await getTaskForEdit(db, id);
    expect(t).toMatchObject({ title: 'Final', description: 'note', dueDate: '2026-11-20', priority: 1, done: true });
  });

  test('updateTask can move a task to someday and back', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Move me', dueDate: TODAY });
    const id = await idOf(db, 'Move me');
    await updateTask(db, id, { title: 'Move me', dueDate: null, priority: 2 });
    expect((await getTaskForEdit(db, id)).dueDate).toBeNull();
    await updateTask(db, id, { title: 'Move me', dueDate: '2026-12-01', priority: 2 });
    expect((await getTaskForEdit(db, id)).dueDate).toBe('2026-12-01');
  });

  test('updateTask validates and refuses unknown ids', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Keep', dueDate: TODAY });
    const id = await idOf(db, 'Keep');
    await expect(updateTask(db, id, { title: '', dueDate: TODAY, priority: 2 })).rejects.toThrow(/task title/);
    await expect(updateTask(db, 'nope', { title: 'x', dueDate: TODAY, priority: 2 })).rejects.toThrow(/no longer exists/);
    expect((await getTaskForEdit(db, id)).title).toBe('Keep');
  });

  test('deleteTask removes the row and is harmless for an unknown id', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Gone', dueDate: TODAY });
    await deleteTask(db, await idOf(db, 'Gone'));
    await deleteTask(db, 'missing');
    expect(await getTaskForEdit(db, 'missing')).toBeNull();
    expect((await db.getAllAsync('SELECT id FROM tasks')).length).toBe(0);
  });

  test('rescheduleTaskToTomorrow moves only the date', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Later', description: 'keep this', dueDate: '2026-11-05', priority: 1 });
    const id = await idOf(db, 'Later');
    await rescheduleTaskToTomorrow(db, id, TODAY);
    expect(await getTaskForEdit(db, id)).toMatchObject({
      dueDate: '2026-11-12',
      description: 'keep this',
      priority: 1,
      done: false,
    });
    await expect(rescheduleTaskToTomorrow(db, 'missing', TODAY)).rejects.toThrow(/no longer exists/);
  });

  test('rescheduling on the last day of the year lands on 1 January', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'New year', dueDate: '2026-12-31' });
    const id = await idOf(db, 'New year');
    await rescheduleTaskToTomorrow(db, id, '2026-12-31');
    expect((await getTaskForEdit(db, id)).dueDate).toBe('2027-01-01');
  });
});

describe('completion toggle', () => {
  test('round-trips done and un-done', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Tick', dueDate: TODAY });
    const id = await idOf(db, 'Tick');

    await toggleTask(db, id);
    expect((await getTaskForEdit(db, id)).done).toBe(true);
    expect((await db.getFirstAsync('SELECT completed_at FROM tasks WHERE id = ?', [id])).completed_at).not.toBeNull();

    await toggleTask(db, id);
    expect((await getTaskForEdit(db, id)).done).toBe(false);
    expect((await db.getFirstAsync('SELECT completed_at FROM tasks WHERE id = ?', [id])).completed_at).toBeNull();
  });

  test('refuses an unknown id', async () => {
    const db = await freshDb();
    await expect(toggleTask(db, 'missing')).rejects.toThrow(/no longer exists/);
  });
});

describe('Planner Today rules', () => {
  test('sorts into earlier, today and someday, with priority order inside each', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Today low', dueDate: TODAY, priority: 3 });
    await addTask(db, { title: 'Today high', dueDate: TODAY, priority: 1 });
    await addTask(db, { title: 'Earlier', dueDate: '2026-11-08', priority: 2 });
    await addTask(db, { title: 'Someday', dueDate: null });
    await addTask(db, { title: 'Tomorrow', dueDate: '2026-11-12' });

    const g = await getPlannerToday(db, TODAY);
    expect(g.today.map((t) => t.title)).toEqual(['Today high', 'Today low']);
    expect(g.earlier.map((t) => t.title)).toEqual(['Earlier']);
    expect(g.earlier[0].overdue).toBe(true);
    expect(g.someday.map((t) => t.title)).toEqual(['Someday']);
  });

  test('a task completed today stays visible, one completed on an earlier day does not', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Done today', dueDate: TODAY });
    await addTask(db, { title: 'Done yesterday', dueDate: '2026-11-10' });
    await addTask(db, { title: 'Done earlier, due today', dueDate: TODAY });
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [noonOf(TODAY), 'Done today']);
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [noonOf('2026-11-10'), 'Done yesterday']);
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [noonOf('2026-11-09'), 'Done earlier, due today']);

    const g = await getPlannerToday(db, TODAY);
    const titles = [...g.earlier, ...g.today, ...g.someday].map((t) => t.title);
    expect(titles).toContain('Done today');
    expect(titles).toContain('Done earlier, due today');
    expect(titles).not.toContain('Done yesterday');
  });

  test('completed-today window is [local midnight, next local midnight)', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'At start', dueDate: '2026-11-01' });
    await addTask(db, { title: 'Just before end', dueDate: '2026-11-01' });
    await addTask(db, { title: 'At next midnight', dueDate: '2026-11-01' });
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [dayStart(TODAY), 'At start']);
    const justBefore = new Date(parseDateKey(addDays(TODAY, 1)).getTime() - 1).toISOString();
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [justBefore, 'Just before end']);
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [dayStart(addDays(TODAY, 1)), 'At next midnight']);

    const titles = Object.values(await getPlannerToday(db, TODAY)).flat().map((t) => t.title);
    expect(titles).toEqual(expect.arrayContaining(['At start', 'Just before end']));
    expect(titles).not.toContain('At next midnight');
  });

  test('open tasks list before done ones', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Done high', dueDate: TODAY, priority: 1 });
    await addTask(db, { title: 'Open low', dueDate: TODAY, priority: 3 });
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [noonOf(TODAY), 'Done high']);
    expect((await getPlannerToday(db, TODAY)).today.map((t) => t.title)).toEqual(['Open low', 'Done high']);
  });

  test('the dashboard list keeps its original rules (no someday tasks)', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Due', dueDate: TODAY });
    await addTask(db, { title: 'Someday', dueDate: null });
    const list = await getTodayTasks(db, TODAY);
    expect(list.map((t) => t.title)).toEqual(['Due']);
    expect(list[0]).toMatchObject({ done: false, overdue: false });
  });
});

describe('week and month queries', () => {
  test('the week starts on Monday and always has seven days', () => {
    expect(weekStartOf('2026-11-11')).toBe('2026-11-09'); // Wed -> Mon
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09'); // Mon -> itself
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09'); // Sun belongs to the week that began on Monday
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
    expect(weekDayKeys('2026-11-11')).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
  });

  test('a week can span two months and two years', () => {
    expect(weekDayKeys('2026-12-30')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(weekStartOf('2026-03-01')).toBe('2026-02-23');
  });

  test('week range label reads naturally across boundaries', () => {
    expect(formatWeekRange('2026-11-11')).toBe('9–15 Nov 2026');
    expect(formatWeekRange('2026-03-01')).toBe('23 Feb – 1 Mar 2026');
    expect(formatWeekRange('2026-12-31')).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  test('week overview counts total and open per day, zero for empty days', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'A', dueDate: '2026-11-09' });
    await addTask(db, { title: 'B', dueDate: '2026-11-09' });
    await addTask(db, { title: 'C', dueDate: '2026-11-15' });
    await addTask(db, { title: 'Next week', dueDate: '2026-11-16' });
    await addTask(db, { title: 'Last week', dueDate: '2026-11-08' });
    await toggleTask(db, await idOf(db, 'A'));

    const week = await getWeekOverview(db, TODAY);
    expect(week.map((d) => d.dateKey)).toEqual(weekDayKeys(TODAY));
    expect(week[0]).toEqual({ dateKey: '2026-11-09', total: 2, open: 1 });
    expect(week[1]).toEqual({ dateKey: '2026-11-10', total: 0, open: 0 });
    expect(week[6]).toEqual({ dateKey: '2026-11-15', total: 1, open: 1 });
  });

  test('week overview across the year boundary includes both ends, excludes the neighbours', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Dec 27', dueDate: '2026-12-27' });
    await addTask(db, { title: 'Dec 28', dueDate: '2026-12-28' });
    await addTask(db, { title: 'Jan 3', dueDate: '2027-01-03' });
    await addTask(db, { title: 'Jan 4', dueDate: '2027-01-04' });

    const week = await getWeekOverview(db, '2027-01-01');
    expect(week[0].dateKey).toBe('2026-12-28');
    expect(week[6].dateKey).toBe('2027-01-03');
    expect(week.map((d) => d.total)).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });

  test('month task days use a half-open range, including February and December', async () => {
    const db = await freshDb();
    for (const d of ['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01', '2027-02-28', '2027-03-01', '2026-12-31']) {
      await addTask(db, { title: `t${d}`, dueDate: d });
    }
    await addTask(db, { title: 'someday', dueDate: null });

    expect([...(await getMonthTaskDays(db, '2026-11'))].sort()).toEqual(['2026-11-01', '2026-11-30']);
    expect([...(await getMonthTaskDays(db, '2026-12'))].sort()).toEqual(['2026-12-01', '2026-12-31']);
    expect([...(await getMonthTaskDays(db, '2027-02'))]).toEqual(['2027-02-28']);
    expect((await getMonthTaskDays(db, '2027-01')).size).toBe(0);
  });

  test('tasks for a day come back open first, by priority, with the earlier flag set relative to today', async () => {
    const db = await freshDb();
    await addTask(db, { title: 'Low', dueDate: '2026-11-05', priority: 3 });
    await addTask(db, { title: 'High', dueDate: '2026-11-05', priority: 1 });
    await addTask(db, { title: 'Done', dueDate: '2026-11-05', priority: 1 });
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE title = ?', [noonOf('2026-11-05'), 'Done']);

    const list = await getTasksForDay(db, '2026-11-05', TODAY);
    expect(list.map((t) => t.title)).toEqual(['High', 'Low', 'Done']);
    expect(list.map((t) => t.overdue)).toEqual([true, true, false]);
    await expect(getTasksForDay(db, 'bad')).rejects.toThrow(/not valid/);
  });

  test('month selection prefers today when it is inside the month', () => {
    expect(selectionForMonth('2026-11', '2026-11-11')).toBe('2026-11-11');
    expect(selectionForMonth('2026-12', '2026-11-11')).toBe('2026-12-01');
    expect(selectionForMonth('2025-11', '2026-11-11')).toBe('2025-11-01');
  });
});
