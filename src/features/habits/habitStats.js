import { addDays, parseDateKey, toDateKey } from '../../utils/dates';

// Pure streak / progress maths. A habit here is { id, startDate, weekdays: number[] } and
// completed days are a Set of local 'YYYY-MM-DD' keys on which the daily target was reached.
// Everything steps through calendar days with Date#setDate (DST-safe), never by adding 24 h.

const MAX_LOOKBACK_DAYS = 3660;

// Inclusive list of { key, weekday } from startKey to endKey, oldest first.
export function listDays(startKey, endKey) {
  const out = [];
  if (startKey > endKey) return out;
  const date = parseDateKey(startKey);
  let key = toDateKey(date);
  while (key <= endKey) {
    out.push({ key, weekday: date.getDay() });
    date.setDate(date.getDate() + 1);
    key = toDateKey(date);
  }
  return out;
}

function firstDay(startDate, today) {
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  return startDate > floor ? startDate : floor;
}

export function isScheduledOn(habit, dateKey) {
  return dateKey >= habit.startDate && habit.weekdays.includes(parseDateKey(dateKey).getDay());
}

// Current streak = consecutive SCHEDULED days with a completion, ending today or the last scheduled
// day before it. Unscheduled days are skipped (they neither count nor break). Today being
// incomplete never breaks the streak: the day isn't over yet.
export function computeStreaks(habit, completed, today) {
  let run = 0;
  let best = 0;
  for (const { key, weekday } of listDays(firstDay(habit.startDate, today), today)) {
    if (!habit.weekdays.includes(weekday)) continue;
    if (completed.has(key)) {
      run += 1;
      if (run > best) best = run;
    } else if (key !== today) {
      run = 0;
    }
  }
  return { current: run, best };
}

// Day-level streak for the Today header: consecutive days on which at least one scheduled habit
// was completed. Days with nothing scheduled are skipped; today is never counted against you.
export function overallStreak(habits, completedByHabit, today) {
  if (habits.length === 0) return 0;
  const earliest = habits.reduce((min, h) => (h.startDate < min ? h.startDate : min), habits[0].startDate);
  let run = 0;
  for (const { key, weekday } of listDays(firstDay(earliest, today), today)) {
    const scheduled = habits.filter((h) => key >= h.startDate && h.weekdays.includes(weekday));
    if (scheduled.length === 0) continue;
    if (scheduled.some((h) => completedByHabit.get(h.id)?.has(key))) run += 1;
    else if (key !== today) run = 0;
  }
  return run;
}

// Weeks run Monday to Sunday.
export function weekStartOf(dateKey) {
  const offset = (parseDateKey(dateKey).getDay() + 6) % 7;
  return addDays(dateKey, -offset);
}

// Completed habit-days over scheduled habit-days from Monday through today (today included).
export function weeklyProgress(habits, completedByHabit, today) {
  const weekStart = weekStartOf(today);
  let scheduled = 0;
  let completed = 0;
  for (const { key, weekday } of listDays(weekStart, today)) {
    for (const h of habits) {
      if (key < h.startDate || !h.weekdays.includes(weekday)) continue;
      scheduled += 1;
      if (completedByHabit.get(h.id)?.has(key)) completed += 1;
    }
  }
  return {
    weekStart,
    scheduled,
    completed,
    percent: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
  };
}

// Garden stages come from the longest run ever. That value can only grow, so a plant never
// wilts or shrinks when a day is skipped.
export const GARDEN_STAGES = [
  { key: 'seed', label: 'Seed', minDays: 0 },
  { key: 'sprout', label: 'Sprout', minDays: 1 },
  { key: 'seedling', label: 'Seedling', minDays: 3 },
  { key: 'bud', label: 'Bud', minDays: 7 },
  { key: 'bloom', label: 'In bloom', minDays: 14 },
];

export function gardenStage(bestStreak) {
  let stage = GARDEN_STAGES[0];
  for (const s of GARDEN_STAGES) if (bestStreak >= s.minDays) stage = s;
  return stage;
}

// rows: [{ habit_id, log_date }] -> Map<habitId, Set<dateKey>>
export function groupCompletedDays(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.habit_id)) map.set(r.habit_id, new Set());
    map.get(r.habit_id).add(r.log_date);
  }
  return map;
}
