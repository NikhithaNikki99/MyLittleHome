import {
  listAllHabits,
  listCompletedHabitDays,
  listScheduleDays,
} from '../../database/repositories/habitRepository';
import { getHabitsForDate } from './habitService';
import {
  computeStreaks,
  gardenStage,
  groupCompletedDays,
  overallStreak,
  weeklyProgress,
} from './habitStats';

// Everything the Habits screen shows, read from SQLite for one local date.
// Archived habits are listed under "All habits" but excluded from Today, the streak and the garden.
export async function loadHabitsOverview(db, today) {
  const [habitRows, scheduleRows, completedRows, dueToday] = await Promise.all([
    listAllHabits(db),
    listScheduleDays(db),
    listCompletedHabitDays(db),
    getHabitsForDate(db, today),
  ]);

  const weekdaysByHabit = new Map();
  for (const r of scheduleRows) {
    if (!weekdaysByHabit.has(r.habit_id)) weekdaysByHabit.set(r.habit_id, []);
    weekdaysByHabit.get(r.habit_id).push(r.weekday);
  }
  const completedByHabit = groupCompletedDays(completedRows);

  const habits = habitRows.map((r) => {
    const weekdays = weekdaysByHabit.get(r.id) ?? [];
    const streaks = computeStreaks(
      { id: r.id, startDate: r.start_date, weekdays },
      completedByHabit.get(r.id) ?? new Set(),
      today,
    );
    return {
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      targetCount: r.target_count,
      startDate: r.start_date,
      archived: r.archived === 1,
      weekdays,
      currentStreak: streaks.current,
      bestStreak: streaks.best,
      stage: gardenStage(streaks.best),
    };
  });

  const active = habits.filter((h) => !h.archived);
  const statsInput = active.map((h) => ({ id: h.id, startDate: h.startDate, weekdays: h.weekdays }));
  const week = weeklyProgress(statsInput, completedByHabit, today);

  return {
    today,
    dueToday,
    dueCount: dueToday.length,
    completedCount: dueToday.filter((h) => h.complete).length,
    streakDays: overallStreak(statsInput, completedByHabit, today),
    weekPercent: week.percent,
    habits,
    garden: active,
  };
}
