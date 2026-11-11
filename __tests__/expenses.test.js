import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import {
  addTransaction,
  deleteTransaction,
  getMonthBreakdown,
  getMonthHistory,
  getMonthSummary,
  getRecentExpenses,
  getTransaction,
  listActiveCategories,
  updateTransaction,
} from '../src/features/expenses/expenseService';
import { allocatePercentages, groupByDay } from '../src/features/expenses/expenseMath';
import { formatPaise, parseRupeesToPaise } from '../src/utils/money';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const spend = (db, over = {}) =>
  addTransaction(db, { title: 'Lunch', amountPaise: 25000, categoryId: 'cat-food', txnDate: '2026-11-11', ...over });

async function onlyId(db) {
  const rows = await db.getAllAsync('SELECT id FROM transactions');
  expect(rows).toHaveLength(1);
  return rows[0].id;
}

describe('addTransaction validation', () => {
  test('stores a trimmed expense with integer paise', async () => {
    const db = await freshDb();
    await spend(db, { title: '  Lunch  ', notes: '  with Asha ' });
    const row = await getTransaction(db, await onlyId(db));
    expect(row).toMatchObject({ kind: 'expense', title: 'Lunch', amount_paise: 25000, notes: 'with Asha', category_name: 'Food' });
  });

  test.each([
    [{ title: '   ' }, /short title/],
    [{ title: 'x'.repeat(81) }, /under 80/],
    [{ amountPaise: 0 }, /above zero/],
    [{ amountPaise: -5 }, /above zero/],
    [{ amountPaise: 10.5 }, /above zero/],
    [{ amountPaise: '250' }, /above zero/],
    [{ txnDate: '2026-02-30' }, /not valid/],
    [{ txnDate: '11/11/2026' }, /not valid/],
    [{ categoryId: null }, /Pick a category/],
    [{ categoryId: 'cat-nope' }, /Pick a category/],
    [{ kind: 'refund' }, /expense or income/],
    [{ notes: 'n'.repeat(501) }, /under 500/],
  ])('rejects %j', async (over, message) => {
    const db = await freshDb();
    await expect(spend(db, over)).rejects.toThrow(message);
    expect((await db.getAllAsync('SELECT id FROM transactions')).length).toBe(0);
  });

  test('rejects an archived category for new entries', async () => {
    const db = await freshDb();
    await db.runAsync("UPDATE expense_categories SET archived = 1 WHERE id = 'cat-travel'");
    await expect(spend(db, { categoryId: 'cat-travel' })).rejects.toThrow(/Pick a category/);
    expect((await listActiveCategories(db)).map((c) => c.id)).not.toContain('cat-travel');
  });
});

describe('updateTransaction and deleteTransaction', () => {
  test('edits every field and bumps updated_at', async () => {
    const db = await freshDb();
    await spend(db);
    const id = await onlyId(db);
    await db.runAsync("UPDATE transactions SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?", [id]);

    await updateTransaction(db, id, {
      kind: 'income',
      title: 'Refund',
      amountPaise: 9900,
      categoryId: 'cat-shopping',
      txnDate: '2026-11-02',
      notes: '',
    });

    const row = await getTransaction(db, id);
    expect(row).toMatchObject({ kind: 'income', title: 'Refund', amount_paise: 9900, category_id: 'cat-shopping', txn_date: '2026-11-02', notes: null });
    const raw = await db.getFirstAsync('SELECT updated_at FROM transactions WHERE id = ?', [id]);
    expect(raw.updated_at > '2020-01-01T00:00:00.000Z').toBe(true);
  });

  test('uses the same validation as add and leaves the row unchanged on error', async () => {
    const db = await freshDb();
    await spend(db);
    const id = await onlyId(db);
    await expect(updateTransaction(db, id, { title: '', amountPaise: 100, categoryId: 'cat-food' })).rejects.toThrow(/short title/);
    await expect(updateTransaction(db, id, { title: 'ok', amountPaise: 0, categoryId: 'cat-food' })).rejects.toThrow(/above zero/);
    expect((await getTransaction(db, id)).title).toBe('Lunch');
  });

  test('an edit may keep a category that has since been archived, but not switch to one', async () => {
    const db = await freshDb();
    await spend(db, { categoryId: 'cat-travel', title: 'Cab' });
    const id = await onlyId(db);
    await db.runAsync("UPDATE expense_categories SET archived = 1 WHERE id IN ('cat-travel', 'cat-bills')");
    await updateTransaction(db, id, { title: 'Cab home', amountPaise: 25000, categoryId: 'cat-travel' });
    expect((await getTransaction(db, id)).title).toBe('Cab home');
    await expect(updateTransaction(db, id, { title: 'Cab', amountPaise: 25000, categoryId: 'cat-bills' })).rejects.toThrow(/Pick a category/);
  });

  test('editing or deleting something that is gone gives a friendly error', async () => {
    const db = await freshDb();
    await expect(updateTransaction(db, 'missing', { title: 'x', amountPaise: 1, categoryId: 'cat-food' })).rejects.toThrow(/no longer exists/);
    await expect(deleteTransaction(db, 'missing')).rejects.toThrow(/no longer exists/);
  });

  test('delete removes only that row', async () => {
    const db = await freshDb();
    await spend(db, { title: 'a' });
    await spend(db, { title: 'b' });
    const [first] = await db.getAllAsync("SELECT id FROM transactions WHERE title = 'a'");
    await deleteTransaction(db, first.id);
    expect((await db.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['b']);
  });
});

describe('month totals use half-open ranges', () => {
  test('the last day of a month counts, the first of the next does not', async () => {
    const db = await freshDb();
    await spend(db, { amountPaise: 100, txnDate: '2026-10-31' });
    await spend(db, { amountPaise: 200, txnDate: '2026-11-01' });
    await spend(db, { amountPaise: 400, txnDate: '2026-11-30' });
    await spend(db, { amountPaise: 800, txnDate: '2026-12-01' });
    await spend(db, { amountPaise: 1600, txnDate: '2026-11-15', kind: 'income', categoryId: 'cat-other' });

    expect(await getMonthSummary(db, '2026-11-11')).toEqual({ expensePaise: 600, incomePaise: 1600, expenseCount: 2 });
    expect(await getMonthSummary(db, '2026-12-25')).toMatchObject({ expensePaise: 800 });
  });

  test('December rolls over into the next year', async () => {
    const db = await freshDb();
    await spend(db, { amountPaise: 300, txnDate: '2026-12-31' });
    await spend(db, { amountPaise: 700, txnDate: '2027-01-01' });
    expect((await getMonthSummary(db, '2026-12-01')).expensePaise).toBe(300);
    expect((await getMonthSummary(db, '2027-01-31')).expensePaise).toBe(700);
  });
});

describe('history', () => {
  async function seeded() {
    const db = await freshDb();
    await spend(db, { title: 'Dosa', amountPaise: 12000, txnDate: '2026-11-03', notes: 'Breakfast, 50% off' });
    await spend(db, { title: 'Auto', amountPaise: 8000, txnDate: '2026-11-03', categoryId: 'cat-travel' });
    await spend(db, { title: 'Salary', amountPaise: 500000, txnDate: '2026-11-01', kind: 'income', categoryId: 'cat-other' });
    await spend(db, { title: 'Old', amountPaise: 100, txnDate: '2026-10-31' });
    return db;
  }

  test('groups by day, newest first, with day and month totals', async () => {
    const h = await getMonthHistory(await seeded(), '2026-11');
    expect(h.days.map((d) => d.date)).toEqual(['2026-11-03', '2026-11-01']);
    expect(h.days[0]).toMatchObject({ expensePaise: 20000, incomePaise: 0 });
    expect(h.days[0].items).toHaveLength(2);
    expect(h).toMatchObject({ count: 3, expensePaise: 20000, incomePaise: 500000 });
  });

  test('filters by category', async () => {
    const h = await getMonthHistory(await seeded(), '2026-11', { categoryId: 'cat-travel' });
    expect(h.days.flatMap((d) => d.items.map((i) => i.title))).toEqual(['Auto']);
  });

  test('searches title and notes, treating % and _ literally', async () => {
    const db = await seeded();
    const titles = async (search) => (await getMonthHistory(db, '2026-11', { search })).days.flatMap((d) => d.items.map((i) => i.title));
    expect(await titles('dosa')).toEqual(['Dosa']);
    expect(await titles('breakfast')).toEqual(['Dosa']);
    expect(await titles('50%')).toEqual(['Dosa']);
    expect(await titles('%')).toEqual(['Dosa']);
    expect(await titles('_')).toEqual([]);
    expect(await titles('   ')).toHaveLength(3);
  });

  test('rejects a malformed month', async () => {
    await expect(getMonthHistory(await freshDb(), '2026-13')).rejects.toThrow(/not valid/);
    await expect(getMonthHistory(await freshDb(), '2026-1')).rejects.toThrow(/not valid/);
  });

  test('recent expenses skip income and respect the limit', async () => {
    const db = await seeded();
    const recent = await getRecentExpenses(db, 2);
    expect(recent).toHaveLength(2);
    expect(recent.every((r) => r.kind === 'expense')).toBe(true);
  });

  test('groupByDay on an empty list is empty', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('breakdown and percentages', () => {
  test('largest-remainder percentages always total 100', () => {
    expect(allocatePercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocatePercentages([50, 50])).toEqual([50, 50]);
    expect(allocatePercentages([1, 2])).toEqual([33, 67]);
    expect(allocatePercentages([0, 5])).toEqual([0, 100]);
    expect(allocatePercentages([])).toEqual([]);
    expect(allocatePercentages([0, 0])).toEqual([0, 0]);
    for (const set of [[7, 7, 7, 7, 7, 7, 7], [1, 99999], [3333, 3333, 3334], [1, 1, 1, 1, 1, 1, 1, 1, 1]]) {
      expect(allocatePercentages(set).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  test('a tiny share never shows more than it should and never steals from zero rows', () => {
    const p = allocatePercentages([1, 99999]);
    expect(p).toEqual([0, 100]);
  });

  test('month breakdown sorts by spend, sums to 100 and excludes income', async () => {
    const db = await freshDb();
    await spend(db, { amountPaise: 10000, categoryId: 'cat-food' });
    await spend(db, { amountPaise: 10000, categoryId: 'cat-travel' });
    await spend(db, { amountPaise: 10000, categoryId: 'cat-bills' });
    await spend(db, { amountPaise: 99900, categoryId: 'cat-other', kind: 'income' });
    await spend(db, { amountPaise: 5000, categoryId: 'cat-food', txnDate: '2026-12-01' });

    const b = await getMonthBreakdown(db, '2026-11');
    expect(b.expensePaise).toBe(30000);
    expect(b.incomePaise).toBe(99900);
    expect(b.categories).toHaveLength(3);
    expect(b.categories.map((c) => c.percent).reduce((a, c) => a + c, 0)).toBe(100);
    expect(b.categories.map((c) => c.percent).sort()).toEqual([33, 33, 34]);
    expect(b.categories.map((c) => c.name)).not.toContain('Other');
  });

  test('an empty month has an empty breakdown', async () => {
    const b = await getMonthBreakdown(await freshDb(), '2026-11');
    expect(b).toEqual({ expensePaise: 0, incomePaise: 0, categories: [] });
  });
});

describe('money parsing edge cases', () => {
  test.each([
    ['250', 25000],
    ['99.5', 9950],
    ['99.50', 9950],
    ['0.07', 7],
    ['5.', 500],
    ['1,23,456.78', 12345678],
    ['₹ 1,250', 125000],
    ['0', 0],
    ['0.00', 0],
  ])('parses %s', (input, paise) => {
    expect(parseRupeesToPaise(input)).toBe(paise);
  });

  test.each(['', 'abc', '-5', '1.234', '1.2.3', '.5', '1e3', '12345678901', null, undefined, 250])('rejects %j', (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });

  test('formats with Indian grouping', () => {
    expect(formatPaise(345000)).toBe('₹3,450');
    expect(formatPaise(1000000)).toBe('₹10,000');
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
  });
});
