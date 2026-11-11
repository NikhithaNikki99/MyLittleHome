import { insertTransaction } from '../../database/repositories/expenseRepository';
import { getCategoryById } from '../../database/repositories/expenseRepository';
import {
  deleteRecurringRow,
  getRecurringById,
  insertOccurrence,
  insertRecurring,
  listOccurrenceDates,
  listRecurringRows,
  setRecurringActiveRow,
  updateRecurringRow,
} from '../../database/repositories/recurringRepository';
import { addDays, isValidDateKey, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { dueDates, isFrequency, monthlyEquivalentPaise, nextDueAfter } from './recurrence';

const MAX_TITLE_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;
const MAX_POSTED_PER_RUN = 400;
const MAX_DAYS_IN_PAST = 366;

// Writes that touch occurrences run one at a time, so a screen opening while another catch-up is running
// can never post the same charge twice or interleave transactions on the one connection.
let queue = Promise.resolve();
function serialized(task) {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

async function validate(db, input, { currentCategoryId = null, startDate, today = null }) {
  const { title, amountPaise, categoryId, endDate, notes } = input;
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) throw new ValidationError('Add a short name.');
  if (cleanTitle.length > MAX_TITLE_LENGTH) throw new ValidationError(`Keep the name under ${MAX_TITLE_LENGTH} characters.`);
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ValidationError('Enter an amount above zero.');
  const category = categoryId ? await getCategoryById(db, categoryId) : null;
  if (!category || (category.archived && categoryId !== currentCategoryId)) throw new ValidationError('Pick a category.');
  if (!isValidDateKey(startDate)) throw new ValidationError('That start date is not valid.');
  if (today && startDate < addDays(today, -MAX_DAYS_IN_PAST)) {
    throw new ValidationError('Pick a start date within the last year. Older charges are not added automatically.');
  }
  if (endDate !== null && endDate !== undefined) {
    if (!isValidDateKey(endDate)) throw new ValidationError('That end date is not valid.');
    if (endDate < startDate) throw new ValidationError('The end date can not be before the start date.');
  }
  const cleanNotes = typeof notes === 'string' ? notes.trim() : '';
  if (cleanNotes.length > MAX_NOTES_LENGTH) throw new ValidationError(`Keep notes under ${MAX_NOTES_LENGTH} characters.`);
  return { title: cleanTitle, amountPaise, categoryId, endDate: endDate ?? null, notes: cleanNotes || null };
}

// Creates a normal expense for every due date up to `today` that has not been handled yet, for active schedules.
// Each charge and its occurrence row are written together, so a failure leaves neither behind.
async function runCatchUp(db, today) {
  const items = await listRecurringRows(db, { activeOnly: true });
  let posted = 0;
  for (const item of items) {
    const handled = new Set(await listOccurrenceDates(db, item.id));
    const missing = dueDates(item.start_date, item.frequency, today, item.end_date)
      .filter((d) => !handled.has(d))
      .slice(0, MAX_POSTED_PER_RUN);
    if (missing.length === 0) continue;
    await db.withTransactionAsync(async () => {
      for (const dueDate of missing) {
        const transactionId = newId();
        const at = nowIso();
        await insertTransaction(db, {
          id: transactionId,
          kind: 'expense',
          title: item.title,
          amountPaise: item.amount_paise,
          categoryId: item.category_id,
          txnDate: dueDate,
          notes: item.notes ?? `Added automatically (${item.frequency})`,
          nowIso: at,
        });
        await insertOccurrence(db, { id: newId(), recurringId: item.id, dueDate, status: 'posted', transactionId, nowIso: at });
      }
    });
    posted += missing.length;
  }
  return { posted };
}

export function postDueRecurring(db, today = toDateKey()) {
  return serialized(() => runCatchUp(db, today));
}

export function createRecurring(db, input, { today = toDateKey() } = {}) {
  return serialized(async () => {
    const startDate = input.startDate ?? today;
    if (!isFrequency(input.frequency)) throw new ValidationError('Choose how often it repeats.');
    const clean = await validate(db, input, { startDate, today });
    const id = newId();
    await insertRecurring(db, { id, ...clean, frequency: input.frequency, startDate, nowIso: nowIso() });
    await runCatchUp(db, today);
    return id;
  });
}

// Name, amount, category, end date and notes can change. The amount applies to future charges only; charges
// already added keep what they were. The schedule itself (frequency, start date) is fixed after creation.
export function updateRecurring(db, id, input) {
  return serialized(async () => {
    const existing = await getRecurringById(db, id);
    if (!existing) throw new ValidationError('That subscription no longer exists.');
    const clean = await validate(db, input, { currentCategoryId: existing.category_id, startDate: existing.start_date });
    await updateRecurringRow(db, { id, ...clean, nowIso: nowIso() });
  });
}

export function setRecurringPaused(db, id, paused, { today = toDateKey() } = {}) {
  return serialized(async () => {
    const existing = await getRecurringById(db, id);
    if (!existing) throw new ValidationError('That subscription no longer exists.');
    if (paused) {
      await setRecurringActiveRow(db, id, false, nowIso());
      return;
    }
    // Charges that fell due while it was paused are marked skipped, not added when it resumes.
    await db.withTransactionAsync(async () => {
      const handled = new Set(await listOccurrenceDates(db, id));
      const at = nowIso();
      for (const dueDate of dueDates(existing.start_date, existing.frequency, today, existing.end_date)) {
        if (handled.has(dueDate)) continue;
        await insertOccurrence(db, { id: newId(), recurringId: id, dueDate, status: 'skipped', transactionId: null, nowIso: at });
      }
      await setRecurringActiveRow(db, id, true, at);
    });
  });
}

// Removes the schedule and its bookkeeping. Charges already added to Expenses stay.
export function deleteRecurring(db, id) {
  return serialized(async () => {
    const changes = await deleteRecurringRow(db, id);
    if (changes === 0) throw new ValidationError('That subscription no longer exists.');
  });
}

function toSubscription(row, today) {
  const nextDueDate = nextDueAfter(row.start_date, row.frequency, today, row.end_date);
  const isActive = row.is_active === 1;
  return {
    id: row.id,
    title: row.title,
    amountPaise: row.amount_paise,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive,
    notes: row.notes,
    nextDueDate,
    status: !isActive ? 'paused' : nextDueDate === null ? 'ended' : 'active',
    monthlyPaise: monthlyEquivalentPaise(row.amount_paise, row.frequency),
  };
}

export async function getRecurring(db, id, today = toDateKey()) {
  const row = await getRecurringById(db, id);
  return row ? toSubscription(row, today) : null;
}

export async function listSubscriptions(db, today = toDateKey()) {
  const rows = await listRecurringRows(db);
  return rows.map((row) => toSubscription(row, today));
}

export function summarizeSubscriptions(items) {
  const active = items.filter((s) => s.status === 'active');
  const upcoming = active.reduce((best, s) => (best === null || s.nextDueDate < best.nextDueDate ? s : best), null);
  return {
    count: active.length,
    monthlyTotalPaise: active.reduce((sum, s) => sum + s.monthlyPaise, 0),
    next: upcoming ? { title: upcoming.title, amountPaise: upcoming.amountPaise, dueDate: upcoming.nextDueDate } : null,
  };
}

export async function getSubscriptionsSummary(db, today = toDateKey()) {
  return summarizeSubscriptions(await listSubscriptions(db, today));
}
