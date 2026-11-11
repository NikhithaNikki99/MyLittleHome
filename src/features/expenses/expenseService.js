import {
  deleteTransactionRow,
  getCategoryById,
  getExpenseTotalForDate,
  getExpenseTotalsByCategory,
  getTotalsForRange,
  getTransactionById,
  insertTransaction,
  listActiveCategories,
  listRecentExpenses,
  listTransactionsInRange,
  updateTransactionRow,
} from '../../database/repositories/expenseRepository';
import { isValidDateKey, monthRange, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { allocatePercentages, groupByDay, isValidMonthKey } from './expenseMath';

export { getExpenseTotalForDate, listActiveCategories };

const MAX_TITLE_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;

// Shared by add and edit so both enforce the same rules. `currentCategoryId` lets an edit keep a category
// that has since been archived, while new entries must use an active one.
async function validateTransaction(db, input, currentCategoryId = null) {
  const { kind, title, amountPaise, categoryId, txnDate, notes } = input;
  if (kind !== 'expense' && kind !== 'income') throw new ValidationError('Choose expense or income.');
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) throw new ValidationError('Add a short title.');
  if (cleanTitle.length > MAX_TITLE_LENGTH) throw new ValidationError(`Keep the title under ${MAX_TITLE_LENGTH} characters.`);
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ValidationError('Enter an amount above zero.');
  if (!isValidDateKey(txnDate)) throw new ValidationError('That date is not valid.');
  const cleanNotes = typeof notes === 'string' ? notes.trim() : '';
  if (cleanNotes.length > MAX_NOTES_LENGTH) throw new ValidationError(`Keep notes under ${MAX_NOTES_LENGTH} characters.`);
  const category = categoryId ? await getCategoryById(db, categoryId) : null;
  if (!category || (category.archived && categoryId !== currentCategoryId)) {
    throw new ValidationError('Pick a category.');
  }
  return { kind, title: cleanTitle, amountPaise, categoryId, txnDate, notes: cleanNotes || null };
}

export async function addTransaction(
  db,
  { kind = 'expense', title, amountPaise, categoryId, txnDate = toDateKey(), notes = null },
) {
  const clean = await validateTransaction(db, { kind, title, amountPaise, categoryId, txnDate, notes });
  await insertTransaction(db, { id: newId(), ...clean, nowIso: nowIso() });
}

export async function updateTransaction(db, id, input) {
  const existing = await getTransactionById(db, id);
  if (!existing) throw new ValidationError('That entry no longer exists.');
  const clean = await validateTransaction(
    db,
    {
      kind: input.kind ?? existing.kind,
      title: input.title,
      amountPaise: input.amountPaise,
      categoryId: input.categoryId,
      txnDate: input.txnDate ?? existing.txn_date,
      notes: input.notes ?? null,
    },
    existing.category_id,
  );
  await updateTransactionRow(db, { id, ...clean, nowIso: nowIso() });
}

export async function deleteTransaction(db, id) {
  const changes = await deleteTransactionRow(db, id);
  if (changes === 0) throw new ValidationError('That entry no longer exists.');
}

export async function getTransaction(db, id) {
  return getTransactionById(db, id);
}

// Totals for the calendar month containing dateKey.
export async function getMonthSummary(db, dateKey) {
  const { start, endExclusive } = monthRange(dateKey);
  return getTotalsForRange(db, start, endExclusive);
}

function monthBounds(monthKey) {
  if (!isValidMonthKey(monthKey)) throw new ValidationError('That month is not valid.');
  return monthRange(`${monthKey}-01`);
}

export async function getRecentExpenses(db, limit = 5) {
  return listRecentExpenses(db, limit);
}

// History for a month: rows grouped by day (newest first) plus the month totals for the same filter.
export async function getMonthHistory(db, monthKey, { categoryId = null, search = '' } = {}) {
  const { start, endExclusive } = monthBounds(monthKey);
  const rows = await listTransactionsInRange(db, start, endExclusive, { categoryId, search });
  const days = groupByDay(rows);
  return {
    days,
    count: rows.length,
    expensePaise: days.reduce((sum, d) => sum + d.expensePaise, 0),
    incomePaise: days.reduce((sum, d) => sum + d.incomePaise, 0),
  };
}

// Spending split for a month: per-category totals with percentages that add up to exactly 100.
export async function getMonthBreakdown(db, monthKey) {
  const { start, endExclusive } = monthBounds(monthKey);
  const [rows, totals] = await Promise.all([
    getExpenseTotalsByCategory(db, start, endExclusive),
    getTotalsForRange(db, start, endExclusive),
  ]);
  const percents = allocatePercentages(rows.map((r) => r.total));
  return {
    expensePaise: totals.expensePaise,
    incomePaise: totals.incomePaise,
    categories: rows.map((r, i) => ({
      categoryId: r.category_id,
      name: r.category_name,
      icon: r.category_icon,
      totalPaise: r.total,
      count: r.count,
      percent: percents[i],
    })),
  };
}
