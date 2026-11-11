// Pure option lists shared by validation (service) and the editor sheet (UI).
// Icon keys map to lucide components in habitIcons.js; colour keys are palette accent tokens.
export const HABIT_ICON_KEYS = [
  'sprout',
  'droplets',
  'book-open',
  'dumbbell',
  'moon',
  'sun',
  'heart',
  'apple',
  'footprints',
  'brain',
  'pencil',
  'music',
  'coffee',
  'leaf',
  'bike',
  'pill',
  'sparkles',
  'flame',
];

export const HABIT_COLOR_KEYS = ['accentSage', 'accentPink', 'accentLavender', 'accentButter', 'accentBlue'];

export const MAX_HABIT_NAME_LENGTH = 60;
export const MAX_HABIT_TARGET = 100;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// Shown Monday-first; `value` is the stored weekday (0 = Sunday).
export const WEEKDAY_OPTIONS = [
  { value: 1, short: 'M', abbr: 'Mon', label: 'Monday' },
  { value: 2, short: 'T', abbr: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'W', abbr: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'T', abbr: 'Thu', label: 'Thursday' },
  { value: 5, short: 'F', abbr: 'Fri', label: 'Friday' },
  { value: 6, short: 'S', abbr: 'Sat', label: 'Saturday' },
  { value: 0, short: 'S', abbr: 'Sun', label: 'Sunday' },
];

export function describeSchedule(weekdays) {
  const days = [...new Set(weekdays)];
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'No days';
  const has = (d) => days.includes(d);
  if (days.length === 5 && [1, 2, 3, 4, 5].every(has)) return 'Weekdays';
  if (days.length === 2 && has(0) && has(6)) return 'Weekends';
  return WEEKDAY_OPTIONS.filter((o) => has(o.value))
    .map((o) => o.abbr)
    .join(', ');
}
