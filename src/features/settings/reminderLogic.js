// Pure reminder rules: defaults, time stepping, (de)serialising the saved choice. No native modules.
export const REMINDERS = [
  { key: 'diary', label: 'Diary', title: 'A moment for your diary', body: 'Write a line or two about today, if you feel like it.', defaultHour: 21, defaultMinute: 0 },
  { key: 'water', label: 'Water', title: 'Sip of water', body: 'A glass of water would be nice.', defaultHour: 15, defaultMinute: 0 },
  { key: 'habits', label: 'Habits', title: 'Your habits', body: 'Have a look at what you would like to do today.', defaultHour: 9, defaultMinute: 0 },
];

export const REMINDER_STEP_MINUTES = 15;

export function reminderById(key) {
  return REMINDERS.find((r) => r.key === key) ?? null;
}

export function defaultReminder(key) {
  const r = reminderById(key);
  return { enabled: false, hour: r.defaultHour, minute: r.defaultMinute };
}

// Stored as JSON text in app_settings. Anything unreadable falls back to "off" with default time.
export function parseReminder(key, raw) {
  const fallback = defaultReminder(key);
  if (typeof raw !== 'string') return fallback;
  try {
    const v = JSON.parse(raw);
    const ok =
      v && typeof v.enabled === 'boolean' && Number.isInteger(v.hour) && Number.isInteger(v.minute) &&
      v.hour >= 0 && v.hour <= 23 && v.minute >= 0 && v.minute <= 59;
    return ok ? { enabled: v.enabled, hour: v.hour, minute: v.minute } : fallback;
  } catch {
    return fallback;
  }
}

export function serializeReminder({ enabled, hour, minute }) {
  return JSON.stringify({ enabled: Boolean(enabled), hour, minute });
}

// Moves the time by whole steps and wraps around midnight.
export function stepTime({ hour, minute }, steps) {
  const total = (((hour * 60 + minute + steps * REMINDER_STEP_MINUTES) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export function formatTime({ hour, minute }) {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${period}`;
}

export function notificationIdentifier(key) {
  return `mlw-reminder-${key}`;
}
