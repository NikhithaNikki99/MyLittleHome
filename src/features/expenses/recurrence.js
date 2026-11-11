// Pure schedule maths for recurring expenses (no database, no native modules).
// Every date is computed from the start date and an index, never from the previous date, so a monthly charge
// that starts on the 31st returns to the 31st after a short month instead of drifting to the 28th.
import { addDays } from '../../utils/dates';
import { ordinal } from '../../utils/ordinal';

export const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

const MAX_STEPS = 10000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
const toKey = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

export function isFrequency(value) {
  return FREQUENCIES.some((f) => f.key === value);
}

// The date of occurrence number `index` (0 is the start date itself).
export function occurrenceDate(startDate, frequency, index) {
  const [year, month, day] = startDate.split('-').map(Number);
  if (frequency === 'weekly') return addDays(startDate, index * 7);
  if (frequency === 'monthly') {
    const total = year * 12 + (month - 1) + index;
    const y = Math.floor(total / 12);
    const m = total % 12;
    return toKey(y, m, Math.min(day, daysInMonth(y, m)));
  }
  if (frequency === 'yearly') {
    const y = year + index;
    return toKey(y, month - 1, Math.min(day, daysInMonth(y, month - 1)));
  }
  throw new Error(`Unknown frequency: ${frequency}`);
}

// Every occurrence on or before `upTo`, and on or before `endDate` when there is one. Oldest first.
export function dueDates(startDate, frequency, upTo, endDate = null) {
  const out = [];
  for (let i = 0; i < MAX_STEPS; i += 1) {
    const date = occurrenceDate(startDate, frequency, i);
    if (date > upTo || (endDate && date > endDate)) break;
    out.push(date);
  }
  return out;
}

// The first occurrence strictly after `afterDate`, or null when the schedule has ended.
export function nextDueAfter(startDate, frequency, afterDate, endDate = null) {
  for (let i = 0; i < MAX_STEPS; i += 1) {
    const date = occurrenceDate(startDate, frequency, i);
    if (endDate && date > endDate) return null;
    if (date > afterDate) return date;
  }
  return null;
}

// What a charge costs per month on average, in whole paise. Used only for the "about X a month" summary.
export function monthlyEquivalentPaise(amountPaise, frequency) {
  if (frequency === 'weekly') return Math.round((amountPaise * 52) / 12);
  if (frequency === 'yearly') return Math.round(amountPaise / 12);
  return amountPaise;
}

export function scheduleLabel(frequency, startDate) {
  const [year, month, day] = startDate.split('-').map(Number);
  if (frequency === 'weekly') return `Every ${WEEKDAYS[new Date(year, month - 1, day).getDay()]}`;
  if (frequency === 'monthly') return `Monthly on the ${ordinal(day)}`;
  return `Every year on ${day} ${MONTHS[month - 1]}`;
}
