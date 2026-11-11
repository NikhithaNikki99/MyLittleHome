import { listEntryRowsForMonth } from '../../database/repositories/reportRepository';
import { monthRange, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { isValidMonthKey } from '../expenses/expenseMath';
import { getMonthBreakdown } from '../expenses/expenseService';
import { getMonthRecap } from '../memories/memoriesService';
import { buildMonthlyReportHtml } from './reportHtml';

const MAX_ENTRIES_LISTED = 200;

export async function buildMonthlyReport(db, monthKey, { today = toDateKey() } = {}) {
  if (!isValidMonthKey(monthKey)) throw new ValidationError('That month is not valid.');
  const { start, endExclusive } = monthRange(`${monthKey}-01`);
  const [recap, breakdown, entries] = await Promise.all([
    getMonthRecap(db, monthKey),
    getMonthBreakdown(db, monthKey),
    listEntryRowsForMonth(db, start, endExclusive, MAX_ENTRIES_LISTED),
  ]);
  return buildMonthlyReportHtml({ monthKey, recap, breakdown, entries, generatedOn: today });
}
