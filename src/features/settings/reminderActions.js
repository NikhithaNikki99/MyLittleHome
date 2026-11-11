import { getDatabase } from '../../database/client';
import { REMINDERS } from './reminderLogic';
import { cancelReminder, scheduleReminder } from './reminderScheduler';
import { readReminders, writeReminder } from './reminderService';

export async function loadReminders() {
  return readReminders(await getDatabase());
}

// Turning a reminder on schedules it first (asking permission only now), then saves the choice, so
// the saved state never claims a reminder that could not be scheduled.
export async function saveReminder(key, value) {
  const db = await getDatabase();
  if (value.enabled) await scheduleReminder(key, value);
  else await cancelReminder(key);
  await writeReminder(db, key, value);
}

// A restore or reinstall can leave schedules out of step with saved choices, so on startup re-apply
// what the user turned on. Silent on failure: reminders are optional.
export async function resyncReminders() {
  try {
    const reminders = await loadReminders();
    for (const r of REMINDERS) {
      if (reminders[r.key].enabled) await scheduleReminder(r.key, reminders[r.key]);
    }
  } catch {
    // Permission revoked or notifications unavailable: keep the saved choice as it is.
  }
}
