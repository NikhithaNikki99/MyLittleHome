import {
  copyBudgets,
  deleteBudget,
  listBudgetsForMonth,
  upsertBudget,
} from '../../database/repositories/budgetRepository';
import { getCategoryById, getExpenseTotalsByCategory, getTotalsForRange, listActiveCategories } from '../../database/repositories/expenseRepository';
import { monthRange, nowIso, shiftMonth } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { budgetProgress, isValidMonthKey } from './expenseMath';

const MAX_LIMIT_PAISE = 100000000000; // ₹1,000,000,000: far above any real budget, below Number precision limits.

function monthBounds(monthKey) {
  if (!isValidMonthKey(monthKey)) throw new ValidationError('That month is not valid.');
  return monthRange(`${monthKey}-01`);
}

// categoryId null = the overall monthly budget.
export async function setBudget(db, { month, categoryId = null, limitPaise }) {
  monthBounds(month);
  if (!Number.isInteger(limitPaise) || limitPaise <= 0) throw new ValidationError('Enter an amount above zero.');
  if (limitPaise > MAX_LIMIT_PAISE) throw new ValidationError('That amount is too large.');
  if (categoryId !== null) {
    const category = await getCategoryById(db, categoryId);
    if (!category || category.archived) throw new ValidationError('Pick a category.');
  }
  await upsertBudget(db, { id: newId(), month, categoryId, limitPaise, nowIso: nowIso() });
}

export async function clearBudget(db, { month, categoryId = null }) {
  monthBounds(month);
  await deleteBudget(db, month, categoryId);
}

// Copies the previous month's budgets into `month`, leaving anything already set for `month` untouched.
export async function copyBudgetsFromPreviousMonth(db, month) {
  monthBounds(month);
  const added = await copyBudgets(db, shiftMonth(month, -1), month, { newId, nowIso: nowIso() });
  if (added === 0) {
    const existing = await listBudgetsForMonth(db, month);
    throw new ValidationError(
      existing.length > 0 ? 'This month already has everything from last month.' : 'Last month has no budgets to copy.',
    );
  }
  return added;
}

// Everything the Budget tab and the Overview card need for one month.
export async function getBudgetOverview(db, month) {
  const { start, endExclusive } = monthBounds(month);
  const [budgets, spentRows, totals, categories] = await Promise.all([
    listBudgetsForMonth(db, month),
    getExpenseTotalsByCategory(db, start, endExclusive),
    getTotalsForRange(db, start, endExclusive),
    listActiveCategories(db),
  ]);

  const limitByCategory = new Map(budgets.filter((b) => b.category_id !== null).map((b) => [b.category_id, b.limit_paise]));
  const spentByCategory = new Map(spentRows.map((r) => [r.category_id, r.total]));
  const overall = budgets.find((b) => b.category_id === null);

  return {
    month,
    spentPaise: totals.expensePaise,
    overall: overall
      ? { limitPaise: overall.limit_paise, ...budgetProgress(totals.expensePaise, overall.limit_paise) }
      : null,
    categories: categories.map((c) => {
      const limitPaise = limitByCategory.get(c.id) ?? null;
      const spentPaise = spentByCategory.get(c.id) ?? 0;
      return {
        categoryId: c.id,
        name: c.name,
        icon: c.icon,
        spentPaise,
        limitPaise,
        progress: limitPaise ? budgetProgress(spentPaise, limitPaise) : null,
      };
    }),
    hasAnyBudget: budgets.length > 0,
  };
}
