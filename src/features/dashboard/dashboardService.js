import { SETTING_KEYS } from '../../constants/settingKeys';
import { getSetting } from '../../database/repositories/settingsRepository';
import { quoteForDate } from '../../utils/quotes';
import { toDateKey } from '../../utils/dates';
import { getExpenseTotalForDate, getMonthSummary } from '../expenses/expenseService';
import { getHabitsForDate } from '../habits/habitService';
import { getTodayTasks } from '../planner/taskService';
import { DEFAULT_WATER_GOAL_ML, getWellnessSnapshot } from '../wellness/wellnessService';

export async function getWaterGoalMl(db) {
  const raw = await getSetting(db, SETTING_KEYS.WATER_GOAL_ML);
  const goal = Number(raw);
  return Number.isInteger(goal) && goal >= 500 && goal <= 10000 ? goal : DEFAULT_WATER_GOAL_ML;
}

// Everything the Home screen shows, read from SQLite for one local date.
export async function loadDashboard(db, dateKey = toDateKey()) {
  const waterGoalMl = await getWaterGoalMl(db);
  const [wellness, monthly, todayExpense, habits, tasks] = await Promise.all([
    getWellnessSnapshot(db, dateKey, waterGoalMl),
    getMonthSummary(db, dateKey),
    getExpenseTotalForDate(db, dateKey),
    getHabitsForDate(db, dateKey),
    getTodayTasks(db, dateKey),
  ]);

  return {
    dateKey,
    quote: quoteForDate(dateKey),
    mood: wellness.mood,
    water: wellness.water,
    weight: wellness.weight,
    spending: {
      todayPaise: todayExpense.totalPaise,
      todayCount: todayExpense.count,
      monthExpensePaise: monthly.expensePaise,
      monthIncomePaise: monthly.incomePaise,
    },
    habits: {
      items: habits,
      dueCount: habits.length,
      completedCount: habits.filter((h) => h.complete).length,
    },
    tasks,
  };
}
