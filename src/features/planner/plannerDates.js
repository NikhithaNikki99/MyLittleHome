import { addDays, parseDateKey, weekdayOf } from '../../utils/dates';

export const WEEKDAYS_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Weeks run Monday to Sunday. weekdayOf is 0 = Sunday, so Monday maps to offset 0.
export function weekStartOf(dateKey) {
  return addDays(dateKey, -((weekdayOf(dateKey) + 6) % 7));
}

export function weekDayKeys(dateKey) {
  const start = weekStartOf(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// '9–15 Nov 2026', '28 Dec – 3 Jan 2027' or '28 Dec 2026 – 3 Jan 2027'. Locale independent.
export function formatWeekRange(dateKey) {
  const first = parseDateKey(weekStartOf(dateKey));
  const last = parseDateKey(addDays(weekStartOf(dateKey), 6));
  const [d1, d2] = [first.getDate(), last.getDate()];
  const [m1, m2] = [MONTHS[first.getMonth()], MONTHS[last.getMonth()]];
  const [y1, y2] = [first.getFullYear(), last.getFullYear()];
  if (y1 !== y2) return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
  if (first.getMonth() !== last.getMonth()) return `${d1} ${m1} – ${d2} ${m2} ${y2}`;
  return `${d1}–${d2} ${m2} ${y2}`;
}

// Month to show after moving the month switcher: today if it falls inside, otherwise the 1st.
export function selectionForMonth(monthKey, todayKey) {
  return todayKey.startsWith(`${monthKey}-`) ? todayKey : `${monthKey}-01`;
}
