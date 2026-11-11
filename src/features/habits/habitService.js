import {
  deleteHabitById,
  deleteHabitLog,
  getHabitById,
  getHabitLog,
  insertHabit,
  listHabitsDueOn,
  replaceScheduleDays,
  setHabitArchivedFlag,
  updateHabitRow,
  upsertHabitLog,
} from '../../database/repositories/habitRepository';
import { isValidDateKey, nowIso, toDateKey, weekdayOf } from '../../utils/dates';
import { ValidationError } from '../../utils/errors';
import { newId } from '../../utils/id';
import { ALL_WEEKDAYS, HABIT_COLOR_KEYS, HABIT_ICON_KEYS, MAX_HABIT_NAME_LENGTH, MAX_HABIT_TARGET } from './habitOptions';

function cleanHabitFields({ name, icon, color, targetCount, weekdays }) {
  const cleanName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!cleanName) throw new ValidationError('Give your habit a name.');
  if (cleanName.length > MAX_HABIT_NAME_LENGTH) {
    throw new ValidationError(`Keep the name under ${MAX_HABIT_NAME_LENGTH} characters.`);
  }
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > MAX_HABIT_TARGET) {
    throw new ValidationError(`Target must be between 1 and ${MAX_HABIT_TARGET}.`);
  }
  const days = [...new Set(weekdays)];
  if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new ValidationError('Pick at least one day.');
  }
  if (!HABIT_ICON_KEYS.includes(icon)) throw new ValidationError('Pick one of the icons.');
  if (!HABIT_COLOR_KEYS.includes(color)) throw new ValidationError('Pick one of the colours.');
  return { name: cleanName, icon, color, targetCount, weekdays: days };
}

export async function createHabit(
  db,
  { name, icon = 'sprout', color = 'accentSage', targetCount = 1, weekdays = ALL_WEEKDAYS, startDate = toDateKey() },
) {
  const fields = cleanHabitFields({ name, icon, color, targetCount, weekdays });
  if (!isValidDateKey(startDate)) throw new ValidationError('That date is not valid.');

  // Habit + its schedule rows are one logical write.
  await db.withTransactionAsync(async () => {
    await insertHabit(db, { id: newId(), ...fields, startDate, nowIso: nowIso() });
  });
}

// Editing never touches logged history. If the daily target is lowered below an existing day's
// count, that day's count is capped so the "n/target" display stays consistent.
export async function updateHabit(db, habitId, { name, icon, color, targetCount, weekdays }) {
  const fields = cleanHabitFields({ name, icon, color, targetCount, weekdays });
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

export async function getHabitsForDate(db, dateKey) {
  const rows = await listHabitsDueOn(db, dateKey, weekdayOf(dateKey));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    targetCount: r.target_count,
    doneCount: r.done_count,
    complete: r.done_count >= r.target_count,
  }));
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
