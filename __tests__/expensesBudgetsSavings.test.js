import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { clearBudget, copyBudgetsFromPreviousMonth, getBudgetOverview, setBudget } from '../src/features/expenses/budgetService';
import { addTransaction } from '../src/features/expenses/expenseService';
import { budgetProgress, goalProgress } from '../src/features/expenses/expenseMath';
import {
  addContribution,
  archiveGoal,
  createGoal,
  deleteGoal,
  getGoalDetail,
  getGoals,
  updateGoal,
} from '../src/features/expenses/savingsService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const spend = (db, over = {}) =>
  addTransaction(db, { title: 'Thing', amountPaise: 10000, categoryId: 'cat-food', txnDate: '2026-11-11', ...over });

describe('budgetProgress', () => {
  test('under, exactly at, and above the limit', () => {
    expect(budgetProgress(25000, 100000)).toEqual({ ratio: 0.25, percent: 25, remainingPaise: 75000, abovePaise: 0, isAbove: false });
    expect(budgetProgress(100000, 100000)).toMatchObject({ ratio: 1, remainingPaise: 0, abovePaise: 0, isAbove: false });
    expect(budgetProgress(130000, 100000)).toEqual({ ratio: 1, percent: 130, remainingPaise: 0, abovePaise: 30000, isAbove: true });
  });

  test('no usable limit means no progress object', () => {
    expect(budgetProgress(500, 0)).toBeNull();
    expect(budgetProgress(500, null)).toBeNull();
    expect(budgetProgress(500, 1.5)).toBeNull();
  });
});

describe('budgets', () => {
  test('overall and category budgets are separate rows; setting again updates in place', async () => {
    const db = await freshDb();
    await setBudget(db, { month: '2026-11', limitPaise: 1000000 });
    await setBudget(db, { month: '2026-11', categoryId: 'cat-food', limitPaise: 300000 });
    await setBudget(db, { month: '2026-11', limitPaise: 1200000 });
    await setBudget(db, { month: '2026-11', categoryId: 'cat-food', limitPaise: 350000 });

    const rows = await db.getAllAsync('SELECT category_id, limit_paise FROM budgets ORDER BY category_id IS NOT NULL');
    expect(rows).toEqual([
      { category_id: null, limit_paise: 1200000 },
      { category_id: 'cat-food', limit_paise: 350000 },
    ]);
  });

  test('each month has its own budget', async () => {
    const db = await freshDb();
    await setBudget(db, { month: '2026-11', limitPaise: 1000 });
    await setBudget(db, { month: '2026-12', limitPaise: 2000 });
    expect((await db.getAllAsync('SELECT * FROM budgets')).length).toBe(2);
  });

  test.each([
    [{ limitPaise: 0 }, /above zero/],
    [{ limitPaise: -1 }, /above zero/],
    [{ limitPaise: 12.5 }, /above zero/],
    [{ limitPaise: 1000, month: '2026-00' }, /not valid/],
    [{ limitPaise: 1000, categoryId: 'cat-nope' }, /Pick a category/],
    [{ limitPaise: 1e12 }, /too large/],
  ])('rejects %j', async (over, message) => {
    const db = await freshDb();
    await expect(setBudget(db, { month: '2026-11', ...over })).rejects.toThrow(message);
    expect((await db.getAllAsync('SELECT * FROM budgets')).length).toBe(0);
  });

  test('clearBudget removes only the targeted row', async () => {
    const db = await freshDb();
    await setBudget(db, { month: '2026-11', limitPaise: 1000 });
    await setBudget(db, { month: '2026-11', categoryId: 'cat-food', limitPaise: 500 });
    await clearBudget(db, { month: '2026-11', categoryId: 'cat-food' });
    expect((await db.getAllAsync('SELECT category_id FROM budgets')).map((r) => r.category_id)).toEqual([null]);
    await clearBudget(db, { month: '2026-11' });
    expect((await db.getAllAsync('SELECT * FROM budgets')).length).toBe(0);
  });

  test('overview combines limits with real spending for that month only', async () => {
    const db = await freshDb();
    await setBudget(db, { month: '2026-11', limitPaise: 100000 });
    await setBudget(db, { month: '2026-11', categoryId: 'cat-food', limitPaise: 20000 });
    await spend(db, { amountPaise: 30000, categoryId: 'cat-food' });
    await spend(db, { amountPaise: 15000, categoryId: 'cat-travel' });
    await spend(db, { amountPaise: 50000, categoryId: 'cat-food', txnDate: '2026-10-31' });
    await spend(db, { amountPaise: 90000, categoryId: 'cat-other', kind: 'income' });

    const o = await getBudgetOverview(db, '2026-11');
    expect(o.spentPaise).toBe(45000);
    expect(o.overall).toMatchObject({ limitPaise: 100000, remainingPaise: 55000, isAbove: false, percent: 45 });
    const food = o.categories.find((c) => c.categoryId === 'cat-food');
    expect(food).toMatchObject({ spentPaise: 30000, limitPaise: 20000 });
    expect(food.progress).toMatchObject({ isAbove: true, abovePaise: 10000, ratio: 1 });
    const travel = o.categories.find((c) => c.categoryId === 'cat-travel');
    expect(travel).toMatchObject({ spentPaise: 15000, limitPaise: null, progress: null });
    expect(o.categories).toHaveLength(9);
    expect(o.hasAnyBudget).toBe(true);
  });

  test('overview with no budget still reports spending and a null overall', async () => {
    const db = await freshDb();
    await spend(db);
    const o = await getBudgetOverview(db, '2026-11');
    expect(o).toMatchObject({ spentPaise: 10000, overall: null, hasAnyBudget: false });
  });

  test('copy from last month adds missing rows and never overwrites existing ones', async () => {
    const db = await freshDb();
    await setBudget(db, { month: '2026-10', limitPaise: 900000 });
    await setBudget(db, { month: '2026-10', categoryId: 'cat-food', limitPaise: 200000 });
    await setBudget(db, { month: '2026-10', categoryId: 'cat-travel', limitPaise: 100000 });
    await setBudget(db, { month: '2026-11', categoryId: 'cat-food', limitPaise: 555 });

    expect(await copyBudgetsFromPreviousMonth(db, '2026-11')).toBe(2);
    const rows = await db.getAllAsync('SELECT category_id, limit_paise FROM budgets WHERE month = ? ORDER BY category_id IS NOT NULL, category_id', ['2026-11']);
    expect(rows).toEqual([
      { category_id: null, limit_paise: 900000 },
      { category_id: 'cat-food', limit_paise: 555 },
      { category_id: 'cat-travel', limit_paise: 100000 },
    ]);
    await expect(copyBudgetsFromPreviousMonth(db, '2026-11')).rejects.toThrow(/already has everything/);
  });

  test('copy across the year boundary and from an empty month', async () => {
    const db = await freshDb();
    await expect(copyBudgetsFromPreviousMonth(db, '2027-01')).rejects.toThrow(/no budgets to copy/);
    await setBudget(db, { month: '2026-12', limitPaise: 4200 });
    expect(await copyBudgetsFromPreviousMonth(db, '2027-01')).toBe(1);
  });
});

describe('goalProgress', () => {
  test('partial, exact and over-target savings', () => {
    expect(goalProgress(2500, 10000)).toEqual({ ratio: 0.25, percent: 25, remainingPaise: 7500, complete: false });
    expect(goalProgress(10000, 10000)).toMatchObject({ ratio: 1, percent: 100, remainingPaise: 0, complete: true });
    expect(goalProgress(15000, 10000)).toMatchObject({ ratio: 1, percent: 100, complete: true });
  });

  test('never rounds up to 100% before the goal is actually met', () => {
    expect(goalProgress(9999, 10000)).toMatchObject({ percent: 99, complete: false });
  });
});

describe('savings goals', () => {
  test('saved amount is the sum of contributions', async () => {
    const db = await freshDb();
    await createGoal(db, { name: 'Trip', targetPaise: 1000000 });
    const [goal] = (await getGoals(db)).active;
    expect(goal).toMatchObject({ name: 'Trip', savedPaise: 0, contributionCount: 0, complete: false });

    await addContribution(db, goal.id, { amountPaise: 250000, contribDate: '2026-11-01' });
    await addContribution(db, goal.id, { amountPaise: 150050, contribDate: '2026-11-05', note: ' bonus ' });

    const detail = await getGoalDetail(db, goal.id);
    expect(detail).toMatchObject({ savedPaise: 400050, contributionCount: 2, percent: 40, remainingPaise: 599950 });
    expect(detail.contributions.map((c) => c.contrib_date)).toEqual(['2026-11-05', '2026-11-01']);
    expect(detail.contributions[0].note).toBe('bonus');
  });

  test('goals complete once contributions reach the target', async () => {
    const db = await freshDb();
    await createGoal(db, { name: 'Phone', targetPaise: 30000 });
    const [goal] = (await getGoals(db)).active;
    await addContribution(db, goal.id, { amountPaise: 20000 });
    expect((await getGoalDetail(db, goal.id)).complete).toBe(false);
    await addContribution(db, goal.id, { amountPaise: 10000 });
    expect((await getGoalDetail(db, goal.id)).complete).toBe(true);
  });

  test('goal and contribution validation', async () => {
    const db = await freshDb();
    await expect(createGoal(db, { name: '  ', targetPaise: 100 })).rejects.toThrow(/name/);
    await expect(createGoal(db, { name: 'x'.repeat(61), targetPaise: 100 })).rejects.toThrow(/under 60/);
    await expect(createGoal(db, { name: 'A', targetPaise: 0 })).rejects.toThrow(/above zero/);
    await expect(createGoal(db, { name: 'A', targetPaise: 1.5 })).rejects.toThrow(/above zero/);
    await expect(createGoal(db, { name: 'A', targetPaise: 100, deadline: '2026-02-31' })).rejects.toThrow(/not valid/);
    await createGoal(db, { name: 'A', targetPaise: 100, deadline: '2027-06-30' });
    const [goal] = (await getGoals(db)).active;
    expect(goal.deadline).toBe('2027-06-30');
    for (const amountPaise of [0, -5, 2.5, '10']) {
      await expect(addContribution(db, goal.id, { amountPaise })).rejects.toThrow(/above zero/);
    }
    await expect(addContribution(db, goal.id, { amountPaise: 10, contribDate: 'soon' })).rejects.toThrow(/not valid/);
    await expect(addContribution(db, 'missing', { amountPaise: 10 })).rejects.toThrow(/no longer exists/);
    expect((await db.getAllAsync('SELECT * FROM savings_contributions')).length).toBe(0);
  });

  test('updateGoal edits name, target and deadline', async () => {
    const db = await freshDb();
    await createGoal(db, { name: 'Old', targetPaise: 100 });
    const [goal] = (await getGoals(db)).active;
    await updateGoal(db, goal.id, { name: ' New ', targetPaise: 500, deadline: null });
    expect((await getGoalDetail(db, goal.id))).toMatchObject({ name: 'New', targetPaise: 500, deadline: null });
    await expect(updateGoal(db, 'missing', { name: 'x', targetPaise: 1 })).rejects.toThrow(/no longer exists/);
  });

  test('archiving moves a goal to the archived list and blocks new contributions until restored', async () => {
    const db = await freshDb();
    await createGoal(db, { name: 'Done', targetPaise: 100 });
    const [goal] = (await getGoals(db)).active;
    await addContribution(db, goal.id, { amountPaise: 100 });
    await archiveGoal(db, goal.id);

    const lists = await getGoals(db);
    expect(lists.active).toHaveLength(0);
    expect(lists.archived[0]).toMatchObject({ name: 'Done', savedPaise: 100, archived: true });
    await expect(addContribution(db, goal.id, { amountPaise: 5 })).rejects.toThrow(/Restore/);

    await archiveGoal(db, goal.id, false);
    expect((await getGoals(db)).active).toHaveLength(1);
    await addContribution(db, goal.id, { amountPaise: 5 });
  });

  test('deleting a goal removes its contributions and nothing else', async () => {
    const db = await freshDb();
    await createGoal(db, { name: 'A', targetPaise: 100 });
    await createGoal(db, { name: 'B', targetPaise: 100 });
    const goals = (await getGoals(db)).active;
    await addContribution(db, goals[0].id, { amountPaise: 10 });
    await addContribution(db, goals[1].id, { amountPaise: 20 });

    await deleteGoal(db, goals[0].id);
    expect((await db.getAllAsync('SELECT goal_id, amount_paise FROM savings_contributions'))).toEqual([
      { goal_id: goals[1].id, amount_paise: 20 },
    ]);
    expect(await getGoalDetail(db, goals[0].id)).toBeNull();
    await expect(deleteGoal(db, goals[0].id)).rejects.toThrow(/no longer exists/);
  });
});

describe('display helpers', () => {
  const { budgetStatusText, paiseToInput, formatDayMonthYear } = require('../src/features/expenses/expenseMath');

  test('budget status wording is neutral in every state', () => {
    expect(budgetStatusText(null)).toBe('');
    expect(budgetStatusText(budgetProgress(25000, 100000))).toBe('₹750 left');
    expect(budgetStatusText(budgetProgress(100000, 100000))).toBe("Right on this month's plan");
    expect(budgetStatusText(budgetProgress(130050, 100000))).toBe("₹300.50 above this month's plan");
    for (const spent of [0, 50000, 100000, 250000]) {
      expect(budgetStatusText(budgetProgress(spent, 100000))).not.toMatch(/over|exceed|fail|overspen|warning/i);
    }
  });

  test('paiseToInput round-trips through the amount parser', () => {
    const { parseRupeesToPaise } = require('../src/utils/money');
    expect(paiseToInput(25000)).toBe('250');
    expect(paiseToInput(9950)).toBe('99.50');
    expect(paiseToInput(7)).toBe('0.07');
    for (const paise of [1, 99, 100, 12345678, 100000000]) {
      expect(parseRupeesToPaise(paiseToInput(paise))).toBe(paise);
    }
  });

  test('dates format without a weekday', () => {
    expect(formatDayMonthYear('2027-06-30')).toMatch(/30/);
    expect(formatDayMonthYear('2027-06-30')).toMatch(/2027/);
  });
});
