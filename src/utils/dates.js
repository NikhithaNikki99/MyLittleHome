// Calendar dates are stored as local 'YYYY-MM-DD' keys (never UTC), so "today" matches the user's wall clock.
// Instants (created_at etc.) are stored as ISO-8601 UTC strings.

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidDateKey(key) {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900) return false;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

export function parseDateKey(key) {
  if (!isValidDateKey(key)) throw new Error(`Invalid date key: ${key}`);
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d);
}

// setDate on a local date is DST-safe, unlike adding 86,400,000 ms.
export function addDays(key, days) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function weekdayOf(key) {
  return parseDateKey(key).getDay();
}

// Half-open range [start, endExclusive) so plain string comparison works in SQL.
export function monthRange(key) {
  const date = parseDateKey(key);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const start = `${y}-${pad(m)}-01`;
  const endExclusive = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { start, endExclusive };
}

// Month keys are 'YYYY-MM'.
export function monthKeyOf(dateKey) {
  return dateKey.slice(0, 7);
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function formatMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function nowIso() {
  return new Date().toISOString();
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function formatLongDate(key) {
  return parseDateKey(key).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShortDate(key) {
  return parseDateKey(key).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
