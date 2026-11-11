import { runMigrations } from '../src/database/migrationRunner';
import { migrations } from '../src/database/migrations';
import { readAllTables, replaceAllTables } from '../src/database/repositories/backupRepository';
import { buildBackupDocument, validateBackupText } from '../src/features/settings/backupFormat';
import { addTransaction, deleteTransaction } from '../src/features/expenses/expenseService';
import { dueDates, monthlyEquivalentPaise, nextDueAfter, occurrenceDate, scheduleLabel } from '../src/features/expenses/recurrence';
import {
  createRecurring,
  deleteRecurring,
  getRecurring,
  getSubscriptionsSummary,
  listSubscriptions,
  postDueRecurring,
  setRecurringPaused,
  updateRecurring,
} from '../src/features/expenses/recurringService';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

const TODAY = '2026-11-11';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

const sub = (db, over = {}, opts = { today: TODAY }) =>
  createRecurring(db, { title: 'Music plan', amountPaise: 11900, categoryId: 'cat-entertainment', frequency: 'monthly', startDate: TODAY, ...over }, opts);

const count = async (db, table) => (await db.getFirstAsync(`SELECT COUNT(*) AS n FROM ${table}`)).n;
const dates = async (db) => (await db.getAllAsync('SELECT txn_date FROM transactions ORDER BY txn_date')).map((r) => r.txn_date);

describe('recurrence maths', () => {
  test('monthly dates clamp to short months and return to the original day', () => {
    expect([0, 1, 2, 3].map((i) => occurrenceDate('2026-01-31', 'monthly', i))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(occurrenceDate('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
  });

  test('monthly dates roll over the year', () => {
    expect(occurrenceDate('2026-11-15', 'monthly', 2)).toBe('2027-01-15');
    expect(occurrenceDate('2026-12-05', 'monthly', 1)).toBe('2027-01-05');
  });

  test('yearly on 29 February falls back to 28 February in other years', () => {
    expect([0, 1, 2, 3, 4].map((i) => occurrenceDate('2024-02-29', 'yearly', i))).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  test('weekly steps by seven days across month ends', () => {
    expect(dueDates('2026-10-28', 'weekly', '2026-11-18')).toEqual(['2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18']);
  });

  test('dueDates stops at the end date and is empty when the start is in the future', () => {
    expect(dueDates('2026-09-01', 'monthly', TODAY, '2026-10-15')).toEqual(['2026-09-01', '2026-10-01']);
    expect(dueDates('2026-12-01', 'monthly', TODAY)).toEqual([]);
  });

  test('nextDueAfter finds the next date, and null once the schedule has ended', () => {
    expect(nextDueAfter('2026-09-05', 'monthly', TODAY)).toBe('2026-12-05');
    expect(nextDueAfter('2026-09-05', 'monthly', '2026-09-05')).toBe('2026-10-05');
    expect(nextDueAfter('2026-09-05', 'monthly', TODAY, '2026-11-30')).toBeNull();
    expect(nextDueAfter('2026-12-01', 'monthly', TODAY)).toBe('2026-12-01');
  });

  test('monthly equivalents are whole paise', () => {
    expect(monthlyEquivalentPaise(12000, 'monthly')).toBe(12000);
    expect(monthlyEquivalentPaise(120000, 'yearly')).toBe(10000);
    expect(Number.isInteger(monthlyEquivalentPaise(10001, 'weekly'))).toBe(true);
    expect(monthlyEquivalentPaise(10000, 'weekly')).toBe(43333);
  });

  test('schedule labels read naturally', () => {
    expect(scheduleLabel('monthly', '2026-11-01')).toBe('Monthly on the 1st');
    expect(scheduleLabel('monthly', '2026-11-12')).toBe('Monthly on the 12th');
    expect(scheduleLabel('monthly', '2026-11-23')).toBe('Monthly on the 23rd');
    expect(scheduleLabel('weekly', '2026-11-11')).toBe('Every Wednesday');
    expect(scheduleLabel('yearly', '2026-03-09')).toBe('Every year on 9 March');
  });
});

describe('migration 010', () => {
  test('creates both tables and enforces the constraints', async () => {
    const db = await freshDb();
    const insert = (over = {}) =>
      db.runAsync(
        `INSERT INTO recurring_expenses (id, title, amount_paise, category_id, frequency, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'n', 'n')`,
        [over.id ?? 'r1', over.title ?? 'Rent', over.amount ?? 1000, over.cat ?? 'cat-bills', over.freq ?? 'monthly', over.start ?? '2026-11-01', over.end ?? null],
      );
    await insert();
    await expect(insert({ id: 'r2', amount: 0 })).rejects.toThrow();
    await expect(insert({ id: 'r3', title: '   ' })).rejects.toThrow();
    await expect(insert({ id: 'r4', freq: 'daily' })).rejects.toThrow();
    await expect(insert({ id: 'r5', cat: 'cat-missing' })).rejects.toThrow();
    await expect(insert({ id: 'r6', start: '11/01/2026' })).rejects.toThrow();
    await expect(insert({ id: 'r7', end: '2026-10-01' })).rejects.toThrow();
  });

  test('an upgrade from version 9 keeps existing data', async () => {
    const db = createTestDatabase();
    await runMigrations(db, migrations.slice(0, 9));
    await addTransaction(db, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: TODAY });
    const applied = await runMigrations(db, migrations);
    expect(applied[0]).toBe(10);
    expect(await count(db, 'transactions')).toBe(1);
    expect(await count(db, 'recurring_expenses')).toBe(0);
  });

  test('the category cannot be deleted while a schedule uses it', async () => {
    const db = await freshDb();
    await sub(db);
    await expect(db.runAsync("DELETE FROM expense_categories WHERE id = 'cat-entertainment'")).rejects.toThrow();
  });
});

describe('creating a subscription', () => {
  test('a subscription starting today posts one expense dated today', async () => {
    const db = await freshDb();
    await sub(db);
    const rows = await db.getAllAsync('SELECT * FROM transactions');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'expense', title: 'Music plan', amount_paise: 11900, category_id: 'cat-entertainment', txn_date: TODAY });
    const occ = await db.getAllAsync('SELECT * FROM recurring_expense_occurrences');
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ status: 'posted', due_date: TODAY, transaction_id: rows[0].id });
  });

  test('a past start date back-fills every missed charge', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-08-15' });
    expect(await dates(db)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15'].filter((d) => d <= TODAY));
  });

  test('a future start date posts nothing yet', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-12-01' });
    expect(await count(db, 'transactions')).toBe(0);
    const [item] = await listSubscriptions(db, TODAY);
    expect(item.nextDueDate).toBe('2026-12-01');
    expect(item.status).toBe('active');
  });

  test('running catch-up again never posts the same charge twice', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-09-01' });
    const before = await count(db, 'transactions');
    await postDueRecurring(db, TODAY);
    await postDueRecurring(db, TODAY);
    expect(await count(db, 'transactions')).toBe(before);
  });

  test('concurrent catch-ups post each charge once', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-12-01' });
    await Promise.all([postDueRecurring(db, '2027-02-15'), postDueRecurring(db, '2027-02-15'), postDueRecurring(db, '2027-02-15')]);
    expect(await dates(db)).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
  });

  test('later days post only the newly due charges', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-10-20' });
    expect(await dates(db)).toEqual(['2026-10-20']);
    const result = await postDueRecurring(db, '2026-12-25');
    expect(result.posted).toBe(2);
    expect(await dates(db)).toEqual(['2026-10-20', '2026-11-20', '2026-12-20']);
  });

  test('an end date stops the charges', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-08-01', endDate: '2026-09-30' });
    expect(await dates(db)).toEqual(['2026-08-01', '2026-09-01']);
    const [item] = await listSubscriptions(db, TODAY);
    expect(item.status).toBe('ended');
    expect(item.nextDueDate).toBeNull();
  });

  test('rejects bad input with readable messages and writes nothing', async () => {
    const db = await freshDb();
    await expect(sub(db, { title: '  ' })).rejects.toThrow('Add a short name.');
    await expect(sub(db, { title: 'x'.repeat(81) })).rejects.toThrow('under 80');
    await expect(sub(db, { amountPaise: 0 })).rejects.toThrow('above zero');
    await expect(sub(db, { amountPaise: 12.5 })).rejects.toThrow('above zero');
    await expect(sub(db, { categoryId: 'cat-missing' })).rejects.toThrow('Pick a category.');
    await expect(sub(db, { categoryId: null })).rejects.toThrow('Pick a category.');
    await expect(sub(db, { frequency: 'daily' })).rejects.toThrow('how often');
    await expect(sub(db, { startDate: '2026-02-30' })).rejects.toThrow('start date');
    await expect(sub(db, { endDate: '2026-01-01' })).rejects.toThrow('before the start');
    await expect(sub(db, { notes: 'n'.repeat(501) })).rejects.toThrow('under 500');
    await expect(sub(db, { startDate: '2020-01-01' })).rejects.toThrow('within the last year');
    expect(await count(db, 'recurring_expenses')).toBe(0);
    expect(await count(db, 'transactions')).toBe(0);
  });

  test('an archived category cannot be chosen for a new subscription', async () => {
    const db = await freshDb();
    await db.runAsync("UPDATE expense_categories SET archived = 1 WHERE id = 'cat-travel'");
    await expect(sub(db, { categoryId: 'cat-travel' })).rejects.toThrow('Pick a category.');
  });
});

describe('editing, pausing and deleting', () => {
  test('editing changes future charges only', async () => {
    const db = await freshDb();
    const id = await sub(db, { startDate: '2026-10-11' });
    await updateRecurring(db, id, { title: 'Music plan (family)', amountPaise: 19900, categoryId: 'cat-entertainment', endDate: null, notes: null });
    expect(await dates(db)).toEqual(['2026-10-11', '2026-11-11']);
    const amounts = (await db.getAllAsync('SELECT amount_paise FROM transactions')).map((r) => r.amount_paise);
    expect(amounts).toEqual([11900, 11900]);

    await postDueRecurring(db, '2026-12-11');
    const last = await db.getFirstAsync("SELECT title, amount_paise FROM transactions WHERE txn_date = '2026-12-11'");
    expect(last).toEqual({ title: 'Music plan (family)', amount_paise: 19900 });
  });

  test('editing keeps the schedule and rejects a missing subscription', async () => {
    const db = await freshDb();
    const id = await sub(db, { startDate: '2026-09-05' });
    await updateRecurring(db, id, { title: 'Renamed', amountPaise: 5000, categoryId: 'cat-bills', endDate: null, notes: 'n' });
    const item = await getRecurring(db, id, TODAY);
    expect(item).toMatchObject({ title: 'Renamed', frequency: 'monthly', startDate: '2026-09-05', categoryId: 'cat-bills', notes: 'n' });
    await expect(updateRecurring(db, 'nope', { title: 'x', amountPaise: 1, categoryId: 'cat-food' })).rejects.toThrow('no longer exists');
  });

  test('a paused subscription posts nothing, and resuming skips what fell due meanwhile', async () => {
    const db = await freshDb();
    const id = await sub(db, { startDate: '2026-08-20' });
    expect(await dates(db)).toEqual(['2026-08-20', '2026-09-20', '2026-10-20']);

    await setRecurringPaused(db, id, true, { today: TODAY });
    await postDueRecurring(db, '2027-01-25');
    expect(await count(db, 'transactions')).toBe(3);
    expect((await listSubscriptions(db, '2027-01-25'))[0].status).toBe('paused');

    await setRecurringPaused(db, id, false, { today: '2027-01-25' });
    const skipped = await db.getAllAsync("SELECT due_date FROM recurring_expense_occurrences WHERE status = 'skipped' ORDER BY due_date");
    expect(skipped.map((r) => r.due_date)).toEqual(['2026-11-20', '2026-12-20', '2027-01-20']);

    await postDueRecurring(db, '2027-01-25');
    expect(await count(db, 'transactions')).toBe(3);
    await postDueRecurring(db, '2027-02-25');
    expect((await dates(db)).pop()).toBe('2027-02-20');
  });

  test('deleting a subscription keeps the expenses it added', async () => {
    const db = await freshDb();
    const id = await sub(db, { startDate: '2026-09-11' });
    expect(await count(db, 'transactions')).toBe(3);
    await deleteRecurring(db, id);
    expect(await count(db, 'recurring_expenses')).toBe(0);
    expect(await count(db, 'recurring_expense_occurrences')).toBe(0);
    expect(await count(db, 'transactions')).toBe(3);
    await postDueRecurring(db, '2027-06-01');
    expect(await count(db, 'transactions')).toBe(3);
    await expect(deleteRecurring(db, id)).rejects.toThrow('no longer exists');
  });

  test('deleting a charge from History does not bring it back', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-10-11' });
    const first = await db.getFirstAsync("SELECT id FROM transactions WHERE txn_date = '2026-10-11'");
    await deleteTransaction(db, first.id);
    expect(await count(db, 'transactions')).toBe(1);
    const orphan = await db.getFirstAsync("SELECT transaction_id, status FROM recurring_expense_occurrences WHERE due_date = '2026-10-11'");
    expect(orphan).toEqual({ transaction_id: null, status: 'posted' });
    await postDueRecurring(db, TODAY);
    expect(await dates(db)).toEqual([TODAY]);
  });

  test('a failure in the middle of a catch-up leaves no partial charges', async () => {
    const db = await freshDb();
    await sub(db, { startDate: '2026-12-01' });
    await db.runAsync(
      `CREATE TRIGGER fail_third BEFORE INSERT ON recurring_expense_occurrences
       WHEN NEW.due_date = '2027-02-01' BEGIN SELECT RAISE(ABORT, 'boom'); END`,
    );
    await expect(postDueRecurring(db, '2027-03-05')).rejects.toThrow('boom');
    expect(await count(db, 'transactions')).toBe(0);
    expect(await count(db, 'recurring_expense_occurrences')).toBe(0);
  });
});

describe('summary', () => {
  test('counts only active subscriptions and finds the soonest next charge', async () => {
    const db = await freshDb();
    await sub(db, { title: 'Rent', amountPaise: 1500000, categoryId: 'cat-bills', startDate: '2026-11-01' });
    await sub(db, { title: 'Gym', amountPaise: 120000, categoryId: 'cat-health', frequency: 'yearly', startDate: '2026-11-20' });
    const pausedId = await sub(db, { title: 'Old plan', amountPaise: 9900, startDate: '2026-11-05' });
    await setRecurringPaused(db, pausedId, true, { today: TODAY });

    const summary = await getSubscriptionsSummary(db, TODAY);
    expect(summary.count).toBe(2);
    expect(summary.monthlyTotalPaise).toBe(1500000 + 10000);
    expect(summary.next).toEqual({ title: 'Gym', amountPaise: 120000, dueDate: '2026-11-20' });
    const rent = (await listSubscriptions(db, TODAY)).find((s) => s.title === 'Rent');
    expect(rent.nextDueDate).toBe('2026-12-01');
  });

  test('is empty when nothing repeats', async () => {
    const db = await freshDb();
    expect(await getSubscriptionsSummary(db, TODAY)).toEqual({ count: 0, monthlyTotalPaise: 0, next: null });
  });
});

describe('backup and restore', () => {
  const NOW = new Date('2026-11-11T10:00:00Z').toISOString();
  const roundTrip = async (source) => {
    const tables = await readAllTables(source);
    const doc = buildBackupDocument({ tables, schemaVersion: migrations.length, appVersion: '1.0.0', exportedAt: NOW });
    return validateBackupText(JSON.stringify(doc), { currentSchemaVersion: migrations.length }).doc;
  };

  test('subscriptions and their occurrences survive a backup and restore', async () => {
    const source = await freshDb();
    await sub(source, { startDate: '2026-09-11' });
    const doc = await roundTrip(source);
    expect(doc.tables.recurring_expenses).toHaveLength(1);
    expect(doc.tables.recurring_expense_occurrences).toHaveLength(3);

    const target = await freshDb();
    await replaceAllTables(target, doc);
    expect(await count(target, 'recurring_expenses')).toBe(1);
    expect(await count(target, 'recurring_expense_occurrences')).toBe(3);
    expect(await count(target, 'transactions')).toBe(3);
    await postDueRecurring(target, TODAY);
    expect(await count(target, 'transactions')).toBe(3);
  });

  test('restoring a backup made before subscriptions existed clears stale subscriptions', async () => {
    const source = await freshDb();
    await addTransaction(source, { title: 'Tea', amountPaise: 2000, categoryId: 'cat-food', txnDate: TODAY });
    const doc = await roundTrip(source);
    delete doc.tables.recurring_expenses;
    delete doc.tables.recurring_expense_occurrences;

    const target = await freshDb();
    await sub(target, { startDate: '2026-10-11' });
    await replaceAllTables(target, doc);
    expect(await count(target, 'recurring_expenses')).toBe(0);
    expect(await count(target, 'recurring_expense_occurrences')).toBe(0);
    expect(await count(target, 'transactions')).toBe(1);
  });

  test('an occurrence pointing at a missing schedule is rejected and nothing changes', async () => {
    const source = await freshDb();
    await sub(source, { startDate: '2026-10-11' });
    const doc = await roundTrip(source);
    doc.tables.recurring_expenses = [];

    const target = await freshDb();
    await addTransaction(target, { title: 'Keep me', amountPaise: 100, categoryId: 'cat-food', txnDate: TODAY });
    await expect(replaceAllTables(target, doc)).rejects.toThrow();
    expect((await target.getAllAsync('SELECT title FROM transactions')).map((r) => r.title)).toEqual(['Keep me']);
  });
});
