import {
  listAllHabits,
  listCompletedHabitDays,
  listScheduleDays,
} from '../../database/repositories/habitRepository';
import { getHabitsForDate } from './habitService';
import { groupWeekdays, scheduleFromRow, streakUnitOf } from './habitSchedule';
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

  const weekdaysByHabit = groupWeekdays(scheduleRows);
  const completedByHabit = groupCompletedDays(completedRows);

  const habits = habitRows.map((r) => {
    const schedule = scheduleFromRow(r, weekdaysByHabit.get(r.id) ?? []);
    const streaks = computeStreaks(schedule, completedByHabit.get(r.id) ?? new Set(), today);
    return {
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      targetCount: r.target_count,
      startDate: r.start_date,
      archived: r.archived === 1,
      scheduleType: schedule.scheduleType,
      weekdays: schedule.weekdays,
      intervalDays: schedule.intervalDays,
      weeklyTarget: schedule.weeklyTarget,
      monthDay: schedule.monthDay,
      streakUnit: streakUnitOf(schedule),
      currentStreak: streaks.current,
      bestStreak: streaks.best,
      stage: gardenStage(streaks.best),
    };
  });

  const active = habits.filter((h) => !h.archived);
  const week = weeklyProgress(active, completedByHabit, today);

  return {
    today,
    dueToday,
    dueCount: dueToday.length,
    completedCount: dueToday.filter((h) => h.complete).length,
    streakDays: overallStreak(active, completedByHabit, today),
    weekPercent: week.percent,
    habits,
    garden: active,
  };
}
