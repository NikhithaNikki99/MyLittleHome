import { parseDateKey } from '../../utils/dates';
import { formatPaise } from '../../utils/money';

// Pure money/summary maths for the Expenses feature. No UI or database imports, so it is unit-tested directly.

// Whole-number percentages that always add up to exactly 100 (largest-remainder method), using integer maths
// only. Ties go to the larger value, then to the earlier item. Returns zeros when the total is zero.
export function allocatePercentages(values) {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);

  const shares = values.map((value, index) => {
    const exact = value * 100;
    return { index, value, floor: Math.floor(exact / total), remainder: exact % total };
  });
  let left = 100 - shares.reduce((sum, s) => sum + s.floor, 0);

  const order = [...shares].sort((a, b) => b.remainder - a.remainder || b.value - a.value || a.index - b.index);
  const percents = shares.map((s) => s.floor);
  for (const s of order) {
    if (left <= 0) break;
    if (s.value > 0) {
      percents[s.index] += 1;
      left -= 1;
    }
  }
  return percents;
}

// Progress against a monthly limit. `ratio` is clamped to 0..1 for bars; `abovePaise` reports any amount over.
export function budgetProgress(spentPaise, limitPaise) {
  if (!Number.isInteger(limitPaise) || limitPaise <= 0) return null;
  const spent = Math.max(0, spentPaise);
  return {
    ratio: Math.min(spent / limitPaise, 1),
    percent: Math.round((spent * 100) / limitPaise),
    remainingPaise: Math.max(limitPaise - spent, 0),
    abovePaise: Math.max(spent - limitPaise, 0),
    isAbove: spent > limitPaise,
  };
}

// Neutral wording for a budget bar: being above the plan is information, not a warning.
export function budgetStatusText(progress) {
  if (!progress) return '';
  if (progress.isAbove) return `${formatPaise(progress.abovePaise)} above this month's plan`;
  if (progress.remainingPaise === 0) return "Right on this month's plan";
  return `${formatPaise(progress.remainingPaise)} left`;
}

export function goalProgress(savedPaise, targetPaise) {
  const saved = Math.max(0, savedPaise);
  return {
    ratio: targetPaise > 0 ? Math.min(saved / targetPaise, 1) : 0,
    percent: targetPaise > 0 ? Math.min(100, Math.floor((saved * 100) / targetPaise)) : 0,
    remainingPaise: Math.max(targetPaise - saved, 0),
    complete: targetPaise > 0 && saved >= targetPaise,
  };
}

// Groups rows (already sorted newest first) into per-day sections, keeping order. Each section carries
// that day's expense and income totals.
export function groupByDay(rows) {
  const sections = [];
  for (const row of rows) {
    let section = sections[sections.length - 1];
    if (!section || section.date !== row.txn_date) {
      section = { date: row.txn_date, expensePaise: 0, incomePaise: 0, items: [] };
      sections.push(section);
    }
    if (row.kind === 'expense') section.expensePaise += row.amount_paise;
    else section.incomePaise += row.amount_paise;
    section.items.push(row);
  }
  return sections;
}

// Integer paise -> text for an editable amount field: 9950 -> "99.50", 25000 -> "250".
export function paiseToInput(paise) {
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  return remainder ? `${rupees}.${String(remainder).padStart(2, '0')}` : String(rupees);
}

// "11 Nov 2026": a calendar date without the weekday (deadlines and contributions).
export function formatDayMonthYear(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function isValidMonthKey(key) {
  if (typeof key !== 'string') return false;
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return false;
  const month = Number(m[2]);
  return Number(m[1]) >= 1900 && month >= 1 && month <= 12;
}
