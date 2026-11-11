import { MOODS } from '../../constants/moods';
import { addDays, formatShortDate, weekdayOf } from '../../utils/dates';

// Pure helpers for series, durations and neutral weight comparisons.

// n local dates ending at endKey, oldest first.
export function lastNDays(endKey, n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) keys.push(addDays(endKey, -i));
  return keys;
}

// One value per key. Days with no row take `fill` (0 for totals, null for "no entry").
export function fillSeries(keys, rows, dateField, valueField, fill = 0) {
  const byDate = new Map(rows.map((r) => [r[dateField], r[valueField]]));
  return keys.map((date) => ({ date, value: byDate.has(date) ? byDate.get(date) : fill }));
}

export function relativeDayLabel(dateKey, today) {
  if (dateKey === today) return 'Today';
  if (dateKey === addDays(today, -1)) return 'Yesterday';
  return formatShortDate(dateKey);
}

// 450 -> "7 h 30 min", 480 -> "8 h", 45 -> "45 min".
export function formatDuration(minutes) {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// Hours and minutes typed separately ("7", "30") -> total minutes, or null when unusable.
export function parseDuration(hoursText, minutesText) {
  const clean = (t) => (typeof t === 'string' ? t.trim() : '');
  const h = clean(hoursText);
  const m = clean(minutesText);
  if (h === '' && m === '') return null;
  if ((h !== '' && !/^\d{1,2}$/.test(h)) || (m !== '' && !/^\d{1,2}$/.test(m))) return null;
  const hours = h === '' ? 0 : Number(h);
  const mins = m === '' ? 0 : Number(m);
  if (mins > 59) return null;
  const total = hours * 60 + mins;
  return total >= 1 && total <= 1440 ? total : null;
}

export function splitDuration(minutes) {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

// Mean of the logged values, rounded; null when nothing is logged (empty days are not zeros).
export function average(values) {
  const present = values.filter((v) => typeof v === 'number');
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}

export function roundKg(kg) {
  return Math.round(kg * 100) / 100;
}

// Plain numbers with a sign; no praise or blame for either direction.
export function describeWeightChange(diffKg) {
  const diff = roundKg(diffKg);
  if (diff === 0) return 'No change';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} kg`;
}

// Progress from the first entry towards an optional goal (either direction).
// Returns null when there's no goal; otherwise { fraction 0..1, remainingKg >= 0 }.
export function weightGoalProgress({ startKg, currentKg, goalKg }) {
  if (goalKg === null || goalKg === undefined) return null;
  const total = goalKg - startKg;
  if (total === 0) return { fraction: roundKg(currentKg) === roundKg(goalKg) ? 1 : 0, remainingKg: roundKg(Math.abs(goalKg - currentKg)) };
  const fraction = Math.max(0, Math.min(1, (currentKg - startKg) / total));
  const reached = total > 0 ? currentKg >= goalKg : currentKg <= goalKg;
  return { fraction: reached ? 1 : fraction, remainingKg: reached ? 0 : roundKg(Math.abs(goalKg - currentKg)) };
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Single-letter weekday for chart labels (static, so it doesn't depend on device Intl support).
export function weekdayLetter(dateKey) {
  return WEEKDAY_LETTERS[weekdayOf(dateKey)];
}

// Gap-tolerant mood summary for a series of { date, value|null }.
export function moodSummary(series) {
  const logged = series.filter((d) => typeof d.value === 'number');
  const counts = new Map();
  for (const d of logged) counts.set(d.value, (counts.get(d.value) ?? 0) + 1);
  let top = null;
  for (const [value, n] of counts) {
    // Ties go to the more recent mood's value order (higher value) so the result is deterministic.
    if (top === null || n > top.n || (n === top.n && value > top.value)) top = { value, n };
  }
  return {
    logged: logged.length,
    total: series.length,
    topLabel: top ? (MOODS.find((m) => m.value === top.value)?.label ?? null) : null,
  };
}

// "9:05 am" from an ISO instant, in the device's local time.
export function formatClock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
