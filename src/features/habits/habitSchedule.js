// Pure schedule rules for habits (no database, no native modules).
// A habit here is { id, startDate, scheduleType, weekdays, intervalDays, weeklyTarget, monthDay }.
// `completed` is a Set of local 'YYYY-MM-DD' keys on which the daily target was reached.
//
// Flexible types work in "windows": a Monday-Sunday week, an N-day period, or the stretch from one monthly
// date to the next. A window is met when it holds at least `quota` completed days. A habit stays on Today
// until its window is met, so doing it a day late still counts and nothing is lost by a busy day.
import { addDays, formatShortDate, monthKeyOf, parseDateKey, shiftMonth } from '../../utils/dates';

export const MAX_LOOKBACK_DAYS = 3660;

const pad = (n) => String(n).padStart(2, '0');

function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function daysBetween(fromKey, toKey) {
  return dayNumber(toKey) - dayNumber(fromKey);
}

export function scheduleTypeOf(habit) {
  return habit.scheduleType ?? 'weekdays';
}

// Unit a streak is counted in: days, repeats ("3 in a row"), weeks or months.
export function streakUnitOf(habit) {
  switch (scheduleTypeOf(habit)) {
    case 'interval':
      return 'time';
    case 'weekly_count':
      return 'week';
    case 'monthly_day':
      return 'month';
    default:
      return 'day';
  }
}

// Weeks run Monday to Sunday.
export function weekStartOf(dateKey) {
  const offset = (parseDateKey(dateKey).getDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

// The monthly date in a 'YYYY-MM' month, falling back to the last day when the month is shorter.
export function monthlyDate(monthKey, day) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}-${pad(m)}-${pad(Math.min(day, new Date(y, m, 0).getDate()))}`;
}

// Whether the schedule names this date. Weekly-count habits can be done on any day, so every day qualifies.
export function isScheduledOn(habit, dateKey) {
  if (dateKey < habit.startDate) return false;
  switch (scheduleTypeOf(habit)) {
    case 'interval':
      return daysBetween(habit.startDate, dateKey) % habit.intervalDays === 0;
    case 'weekly_count':
      return true;
    case 'monthly_day':
      return dateKey === monthlyDate(monthKeyOf(dateKey), habit.monthDay);
    default:
      return habit.weekdays.includes(parseDateKey(dateKey).getDay());
  }
}

// The window of a flexible habit that contains dateKey, or null before its first one (and for weekday habits).
export function windowFor(habit, dateKey) {
  const type = scheduleTypeOf(habit);
  if (type === 'weekdays' || dateKey < habit.startDate) return null;

  if (type === 'weekly_count') {
    const weekStart = weekStartOf(dateKey);
    return {
      start: weekStart < habit.startDate ? habit.startDate : weekStart,
      endExclusive: addDays(weekStart, 7),
      quota: habit.weeklyTarget,
    };
  }

  if (type === 'interval') {
    const k = Math.floor(daysBetween(habit.startDate, dateKey) / habit.intervalDays);
    const start = addDays(habit.startDate, k * habit.intervalDays);
    return { start, endExclusive: addDays(start, habit.intervalDays), quota: 1 };
  }

  const month = monthKeyOf(dateKey);
  const thisMonth = monthlyDate(month, habit.monthDay);
  const [start, endExclusive] =
    dateKey >= thisMonth
      ? [thisMonth, monthlyDate(shiftMonth(month, 1), habit.monthDay)]
      : [monthlyDate(shiftMonth(month, -1), habit.monthDay), thisMonth];
  return start < habit.startDate ? null : { start, endExclusive, quota: 1 };
}

// Every window from the habit's first up to the one containing `today`, oldest first.
export function listWindows(habit, today) {
  const type = scheduleTypeOf(habit);
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  const from = habit.startDate > floor ? habit.startDate : floor;
  const out = [];
  if (type === 'weekdays' || from > today) return out;

  if (type === 'weekly_count') {
    for (let weekStart = weekStartOf(from); weekStart <= today; weekStart = addDays(weekStart, 7)) {
      out.push({
        start: weekStart < habit.startDate ? habit.startDate : weekStart,
        endExclusive: addDays(weekStart, 7),
        quota: habit.weeklyTarget,
      });
    }
  } else if (type === 'interval') {
    const first = Math.max(0, Math.floor(daysBetween(habit.startDate, from) / habit.intervalDays));
    for (let k = first; ; k += 1) {
      const start = addDays(habit.startDate, k * habit.intervalDays);
      if (start > today) break;
      out.push({ start, endExclusive: addDays(start, habit.intervalDays), quota: 1 });
    }
  } else {
    for (let month = monthKeyOf(from); ; month = shiftMonth(month, 1)) {
      const start = monthlyDate(month, habit.monthDay);
      if (start > today) break;
      if (start < habit.startDate) continue;
      out.push({ start, endExclusive: monthlyDate(shiftMonth(month, 1), habit.monthDay), quota: 1 });
    }
  }
  return out;
}

// Completed days in [start, endExclusive).
export function countInRange(completed, start, endExclusive) {
  let n = 0;
  for (const key of completed) if (key >= start && key < endExclusive) n += 1;
  return n;
}

// Is the habit on Today's list for dateKey, and is there a short note to show beside it?
export function dueInfo(habit, dateKey, completed) {
  if (dateKey < habit.startDate) return { due: false, note: null };
  if (scheduleTypeOf(habit) === 'weekdays') return { due: isScheduledOn(habit, dateKey), note: null };

  const window = windowFor(habit, dateKey);
  if (!window) return { due: false, note: null };

  const doneBefore = countInRange(completed, window.start, dateKey);
  const doneToday = completed.has(dateKey);
  const due = doneToday || doneBefore < window.quota;

  let note = null;
  if (due && scheduleTypeOf(habit) === 'weekly_count') {
    note = `${doneBefore + (doneToday ? 1 : 0)} of ${window.quota} this week`;
  } else if (due && !doneToday && window.start < dateKey) {
    note = `Since ${formatShortDate(window.start)}`;
  }
  return { due, note };
}

// Builds the schedule object used above from a database row (snake_case) and its weekday list.
export function scheduleFromRow(row, weekdays = []) {
  return {
    id: row.id,
    startDate: row.start_date,
    scheduleType: row.schedule_type ?? 'weekdays',
    weekdays,
    intervalDays: row.interval_days ?? null,
    weeklyTarget: row.weekly_target ?? null,
    monthDay: row.month_day ?? null,
  };
}

// rows: [{ habit_id, weekday }] -> Map<habitId, number[]>
export function groupWeekdays(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.habit_id)) map.set(r.habit_id, []);
    map.get(r.habit_id).push(r.weekday);
  }
  return map;
}
