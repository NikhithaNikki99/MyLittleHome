import {
  deleteHabitById,
  deleteHabitLog,
  getHabitById,
  getHabitLog,
  insertHabit,
  listActiveHabitsStartedBy,
  listCompletedHabitDays,
  listLogCountsOn,
  listScheduleDays,
  replaceScheduleDays,
  setHabitArchivedFlag,
  updateHabitRow,
  upsertHabitLog,
} from '../../database/repositories/habitRepository';
import { isValidDateKey, nowIso, toDateKey } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import {
  ALL_WEEKDAYS,
  HABIT_COLOR_KEYS,
  HABIT_ICON_KEYS,
  INTERVAL_RANGE,
  MAX_HABIT_NAME_LENGTH,
  MAX_HABIT_TARGET,
  SCHEDULE_TYPES,
  WEEKLY_TARGET_RANGE,
} from './habitOptions';
import { dueInfo, groupWeekdays, scheduleFromRow } from './habitSchedule';
import { groupCompletedDays } from './habitStats';

const isInt = (value) => Number.isInteger(value);

// Only the settings that belong to the chosen schedule type are kept; the rest are cleared, so a habit never
// carries leftovers from an earlier schedule.
function cleanSchedule({ scheduleType = 'weekdays', weekdays = ALL_WEEKDAYS, intervalDays, weeklyTarget, monthDay }) {
  if (!SCHEDULE_TYPES.some((t) => t.key === scheduleType)) throw new ValidationError('Choose how often it repeats.');
  const empty = { scheduleType, weekdays: [], intervalDays: null, weeklyTarget: null, monthDay: null };

  if (scheduleType === 'weekdays') {
    const days = [...new Set(weekdays)];
    if (days.length === 0 || days.some((d) => !isInt(d) || d < 0 || d > 6)) throw new ValidationError('Pick at least one day.');
    return { ...empty, weekdays: days };
  }
  if (scheduleType === 'interval') {
    if (!isInt(intervalDays) || intervalDays < INTERVAL_RANGE.min || intervalDays > INTERVAL_RANGE.max) {
      throw new ValidationError(`Choose between every ${INTERVAL_RANGE.min} and every ${INTERVAL_RANGE.max} days.`);
    }
    return { ...empty, intervalDays };
  }
  if (scheduleType === 'weekly_count') {
    if (!isInt(weeklyTarget) || weeklyTarget < WEEKLY_TARGET_RANGE.min || weeklyTarget > WEEKLY_TARGET_RANGE.max) {
      throw new ValidationError(`Choose between ${WEEKLY_TARGET_RANGE.min} and ${WEEKLY_TARGET_RANGE.max} times a week. For every day, use days of the week.`);
    }
    return { ...empty, weeklyTarget };
  }
  if (!isInt(monthDay) || monthDay < 1 || monthDay > 31) throw new ValidationError('Choose a day of the month from 1 to 31.');
  return { ...empty, monthDay };
}

function cleanHabitFields({ name, icon, color, targetCount, ...schedule }) {
  const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!cleanName) throw new ValidationError('Give your habit a name.');
  if (cleanName.length > MAX_HABIT_NAME_LENGTH) {
    throw new ValidationError(`Keep the name under ${MAX_HABIT_NAME_LENGTH} characters.`);
  }
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > MAX_HABIT_TARGET) {
    throw new ValidationError(`Target must be between 1 and ${MAX_HABIT_TARGET}.`);
  }
  if (!HABIT_ICON_KEYS.includes(icon)) throw new ValidationError('Pick one of the icons.');
  if (!HABIT_COLOR_KEYS.includes(color)) throw new ValidationError('Pick one of the colours.');
  return { name: cleanName, icon, color, targetCount, ...cleanSchedule(schedule) };
}

export async function createHabit(
  db,
  { name, icon = 'sprout', color = 'accentSage', targetCount = 1, startDate = toDateKey(), ...schedule },
) {
  const fields = cleanHabitFields({ name, icon, color, targetCount, ...schedule });
  if (!isValidDateKey(startDate)) throw new ValidationError('That date is not valid.');

  // Habit + its schedule rows are one logical write.
  await db.withTransactionAsync(async () => {
    await insertHabit(db, { id: newId(), ...fields, startDate, nowIso: nowIso() });
  });
}

// Editing never touches logged history. If the daily target is lowered below an existing day's
// count, that day's count is capped so the "n/target" display stays consistent.
export async function updateHabit(db, habitId, { name, icon, color, targetCount, ...schedule }) {
  const fields = cleanHabitFields({ name, icon, color, targetCount, ...schedule });
  await db.withTransactionAsync(async () => {
    const habit = await getHabitById(db, habitId);
    if (!habit) throw new ValidationError('That habit no longer exists.');
    await updateHabitRow(db, { id: habitId, ...fields, nowIso: nowIso() });
    await replaceScheduleDays(db, habitId, fields.weekdays);
    await db.runAsync('UPDATE habit_logs SET count = ? WHERE habit_id = ? AND count > ?', [
      fields.targetCount,
      habitId,
      fields.targetCount,
    ]);
  });
}

// Archiving hides a habit from Today and the garden but keeps every log.
export async function setHabitArchived(db, habitId, archived) {
  const habit = await getHabitById(db, habitId);
  if (!habit) throw new ValidationError('That habit no longer exists.');
  await setHabitArchivedFlag(db, habitId, archived, nowIso());
}

// Permanent: removes the habit, its schedule and all logs in one transaction.
export async function deleteHabit(db, habitId) {
  await db.withTransactionAsync(async () => {
    const habit = await getHabitById(db, habitId);
    if (!habit) throw new ValidationError('That habit no longer exists.');
    await deleteHabitById(db, habitId);
  });
}

// Habits to show for a date. Weekday habits appear on their days; flexible habits stay listed until their window
// (week, period or month) is met, then show as done on the day they were completed.
export async function getHabitsForDate(db, dateKey) {
  const [rows, scheduleRows, completedRows, todayLogs] = await Promise.all([
    listActiveHabitsStartedBy(db, dateKey),
    listScheduleDays(db),
    listCompletedHabitDays(db),
    listLogCountsOn(db, dateKey),
  ]);
  const weekdaysByHabit = groupWeekdays(scheduleRows);
  const completedByHabit = groupCompletedDays(completedRows);
  const doneCountById = new Map(todayLogs.map((l) => [l.habit_id, l.count]));

  const out = [];
  for (const r of rows) {
    const habit = scheduleFromRow(r, weekdaysByHabit.get(r.id) ?? []);
    const { due, note } = dueInfo(habit, dateKey, completedByHabit.get(r.id) ?? new Set());
    if (!due) continue;
    const doneCount = doneCountById.get(r.id) ?? 0;
    out.push({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      targetCount: r.target_count,
      doneCount,
      complete: doneCount >= r.target_count,
      note,
    });
  }
  return out;
}

async function requireActiveHabit(db, habitId) {
  const habit = await getHabitById(db, habitId);
  if (!habit || habit.archived) throw new ValidationError('That habit is no longer available.');
  return habit;
}

// Single-target habits toggle done/not done; multi-target habits step forward and wrap back to zero.
export async function advanceHabit(db, habitId, dateKey = toDateKey()) {
  if (!isValidDateKey(dateKey)) throw new ValidationError('That date is not valid.');
  await db.withTransactionAsync(async () => {
    const habit = await requireActiveHabit(db, habitId);
    const log = await getHabitLog(db, habitId, dateKey);
    const current = log ? log.count : 0;

    if (habit.target_count === 1) {
      if (current >= 1) await deleteHabitLog(db, habitId, dateKey);
      else await upsertHabitLog(db, { id: newId(), habitId, logDate: dateKey, count: 1, nowIso: nowIso() });
      return;
    }

    const next = current + 1;
    if (next > habit.target_count) {
      await deleteHabitLog(db, habitId, dateKey);
    } else {
      await upsertHabitLog(db, { id: newId(), habitId, logDate: dateKey, count: next, nowIso: nowIso() });
    }
  });
}
