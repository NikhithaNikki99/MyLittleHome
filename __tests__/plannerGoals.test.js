import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { goalProgress } from '../src/features/planner/goalProgress';
import {
  addGoal,
  addMilestone,
  deleteGoal,
  deleteMilestone,
  getGoalDetail,
  getGoals,
  toggleGoalComplete,
  toggleMilestone,
  updateGoal,
} from '../src/features/planner/goalService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('goalProgress', () => {
  test('zero milestones is 0% and says so, never NaN', () => {
    expect(goalProgress({ milestoneTotal: 0, milestoneDone: 0, completed: false })).toEqual({
      ratio: 0,
      percent: 0,
      label: 'No milestones yet',
    });
  });

  test('done over total, rounded, with singular and plural labels', () => {
    expect(goalProgress({ milestoneTotal: 3, milestoneDone: 1, completed: false })).toMatchObject({
      percent: 33,
      label: '1 of 3 milestones',
    });
    expect(goalProgress({ milestoneTotal: 3, milestoneDone: 2, completed: false }).percent).toBe(67);
    expect(goalProgress({ milestoneTotal: 1, milestoneDone: 0, completed: false }).label).toBe('0 of 1 milestone');
  });

  test('a completed goal reads 100% even with no or unfinished milestones', () => {
    expect(goalProgress({ milestoneTotal: 0, milestoneDone: 0, completed: true }).percent).toBe(100);
    expect(goalProgress({ milestoneTotal: 4, milestoneDone: 1, completed: true })).toMatchObject({
      ratio: 1,
      label: 'Complete',
    });
  });

  test('clamps done to the total', () => {
    expect(goalProgress({ milestoneTotal: 2, milestoneDone: 5, completed: false }).ratio).toBe(1);
  });
});

describe('goals', () => {
  test('validation: name required, length capped, date must be real', async () => {
    const db = await freshDb();
    await expect(addGoal(db, { title: '  ' })).rejects.toThrow(/name/);
    await expect(addGoal(db, { title: 'x'.repeat(121) })).rejects.toThrow(/120/);
    await expect(addGoal(db, { title: 'Ok', targetDate: '2026-13-01' })).rejects.toThrow(/not valid/);
    expect((await getGoals(db)).length).toBe(0);
  });

  test('add, read, edit and clear the target date', async () => {
    const db = await freshDb();
    const id = await addGoal(db, { title: '  Run 5k  ', description: ' slowly ', targetDate: '2027-03-01' });

    let g = (await getGoals(db))[0];
    expect(g).toMatchObject({ id, title: 'Run 5k', description: 'slowly', targetDate: '2027-03-01', completed: false });

    await updateGoal(db, id, { title: 'Run 10k', description: '', targetDate: null });
    g = (await getGoals(db))[0];
    expect(g).toMatchObject({ title: 'Run 10k', description: null, targetDate: null });
    await expect(updateGoal(db, 'missing', { title: 'x' })).rejects.toThrow(/no longer exists/);
  });

  test('complete and reopen round-trip without touching milestones', async () => {
    const db = await freshDb();
    const id = await addGoal(db, { title: 'Read more' });
    await addMilestone(db, id, 'Pick a book');

    await toggleGoalComplete(db, id);
    let g = (await getGoals(db))[0];
    expect(g.completed).toBe(true);
    expect(g.progress.percent).toBe(100);
    expect(g.milestoneDone).toBe(0);

    await toggleGoalComplete(db, id);
    g = (await getGoals(db))[0];
    expect(g.completed).toBe(false);
    expect(g.progress.percent).toBe(0);
    await expect(toggleGoalComplete(db, 'missing')).rejects.toThrow(/no longer exists/);
  });

  test('list order: open goals by nearest target date (undated last), completed goals at the end', async () => {
    const db = await freshDb();
    await addGoal(db, { title: 'No date' });
    await addGoal(db, { title: 'Far', targetDate: '2027-06-01' });
    await addGoal(db, { title: 'Near', targetDate: '2026-12-01' });
    const doneId = await addGoal(db, { title: 'Finished', targetDate: '2026-01-01' });
    await toggleGoalComplete(db, doneId);

    expect((await getGoals(db)).map((g) => g.title)).toEqual(['Near', 'Far', 'No date', 'Finished']);
  });
});

describe('milestones', () => {
  test('add keeps order, toggle updates the goal progress, delete removes one', async () => {
    const db = await freshDb();
    const id = await addGoal(db, { title: 'Learn guitar' });
    await addMilestone(db, id, 'Buy a guitar');
    await addMilestone(db, id, '  First chord  ');
    await addMilestone(db, id, 'First song');

    let d = await getGoalDetail(db, id);
    expect(d.milestones.map((m) => m.title)).toEqual(['Buy a guitar', 'First chord', 'First song']);
    expect(d.progress).toMatchObject({ percent: 0, label: '0 of 3 milestones' });

    await toggleMilestone(db, d.milestones[0].id);
    await toggleMilestone(db, d.milestones[1].id);
    d = await getGoalDetail(db, id);
    expect(d.milestones.map((m) => m.done)).toEqual([true, true, false]);
    expect(d.progress).toMatchObject({ percent: 67, label: '2 of 3 milestones' });
    expect((await getGoals(db))[0]).toMatchObject({ milestoneTotal: 3, milestoneDone: 2 });

    await toggleMilestone(db, d.milestones[0].id);
    expect((await getGoalDetail(db, id)).milestones[0].done).toBe(false);

    await deleteMilestone(db, d.milestones[1].id);
    d = await getGoalDetail(db, id);
    expect(d.milestones.map((m) => m.title)).toEqual(['Buy a guitar', 'First song']);
  });

  test('a milestone added after a delete still goes to the end', async () => {
    const db = await freshDb();
    const id = await addGoal(db, { title: 'G' });
    await addMilestone(db, id, 'one');
    await addMilestone(db, id, 'two');
    const first = (await getGoalDetail(db, id)).milestones[0];
    await deleteMilestone(db, first.id);
    await addMilestone(db, id, 'three');
    expect((await getGoalDetail(db, id)).milestones.map((m) => m.title)).toEqual(['two', 'three']);
  });

  test('validation: name required, goal must exist, toggle needs a real id', async () => {
    const db = await freshDb();
    const id = await addGoal(db, { title: 'G' });
    await expect(addMilestone(db, id, '   ')).rejects.toThrow(/milestone name/);
    await expect(addMilestone(db, id, 'x'.repeat(121))).rejects.toThrow(/120/);
    await expect(addMilestone(db, 'missing', 'x')).rejects.toThrow(/no longer exists/);
    await expect(toggleMilestone(db, 'missing')).rejects.toThrow(/no longer exists/);
    expect((await getGoalDetail(db, id)).milestones).toEqual([]);
  });

  test('deleting a goal cascades to its milestones and leaves other goals alone', async () => {
    const db = await freshDb();
    const a = await addGoal(db, { title: 'A' });
    const b = await addGoal(db, { title: 'B' });
    await addMilestone(db, a, 'a1');
    await addMilestone(db, a, 'a2');
    await addMilestone(db, b, 'b1');

    await deleteGoal(db, a);
    expect(await getGoalDetail(db, a)).toBeNull();
    const rows = await db.getAllAsync('SELECT goal_id, title FROM goal_milestones');
    expect(rows).toEqual([{ goal_id: b, title: 'b1' }]);
    expect((await getGoals(db)).map((g) => g.title)).toEqual(['B']);
  });

  test('goal detail for an unknown id is null', async () => {
    const db = await freshDb();
    expect(await getGoalDetail(db, 'missing')).toBeNull();
  });
});
