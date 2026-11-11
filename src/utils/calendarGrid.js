import { addDays, toDateKey } from './dates';

// Weeks (Sunday-first) covering the month 'YYYY-MM'. Each cell is { dateKey, day, inMonth }.
// Leading/trailing cells from adjacent months are included so every row has 7 cells.
export function buildMonthGrid(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const startKey = addDays(toDateKey(first), -first.getDay());
  const cellCount = Math.ceil((first.getDay() + lastDay) / 7) * 7;

  const weeks = [];
  for (let i = 0; i < cellCount; i += 7) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateKey = addDays(startKey, i + d);
      const [cy, cm, cd] = dateKey.split('-').map(Number);
      week.push({ dateKey, day: cd, inMonth: cy === y && cm === m });
    }
    weeks.push(week);
  }
  return weeks;
}
