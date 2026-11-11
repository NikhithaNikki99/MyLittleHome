import { migrations } from '../src/database/migrations';
import { runMigrations } from '../src/database/migrationRunner';
import { getAllSettings, getSetting, setSetting } from '../src/database/repositories/settingsRepository';
import { EXCLUDED_SETTING_KEYS } from '../src/features/settings/backupFormat';
import {
  REMINDERS,
  defaultReminder,
  formatTime,
  nextFireDay,
  parseReminder,
  serializeReminder,
  stepTime,
} from '../src/features/settings/reminderLogic';
import { readReminders, writeReminder } from '../src/features/settings/reminderService';
import { SECURE_KEYS, SETTINGS_FEATURE_KEYS } from '../src/features/settings/settingKeys';
import { createTestDatabase } from './helpers/nodeSqliteAdapter';

async function freshDb() {
  const db = createTestDatabase();
  await runMigrations(db, migrations);
  return db;
}

describe('settings persistence', () => {
  test('values round-trip as text and later writes replace earlier ones', async () => {
    const db = await freshDb();
    expect(await getSetting(db, 'profile_name')).toBeNull();
    await setSetting(db, 'profile_name', 'Nikki');
    await setSetting(db, 'profile_name', 'Sai');
    await setSetting(db, 'water_goal_ml', 2500);
    expect(await getSetting(db, 'profile_name')).toBe('Sai');
    expect(await getAllSettings(db)).toEqual({ profile_name: 'Sai', water_goal_ml: '2500' });
  });

  test('keys that must stay on this phone are excluded from backups', () => {
    for (const key of Object.values(SETTINGS_FEATURE_KEYS)) {
      expect(EXCLUDED_SETTING_KEYS.has(key)).toBe(true);
    }
  });

  test('the PIN is stored under a secure-store key, not an app_settings key', async () => {
    const db = await freshDb();
    expect(Object.values(SETTINGS_FEATURE_KEYS)).not.toContain(SECURE_KEYS.PIN_RECORD);
    expect(await getSetting(db, SECURE_KEYS.PIN_RECORD)).toBeNull();
  });
});

describe('reminder time logic', () => {
  test('steps in 15 minute increments and wraps around midnight', () => {
    expect(stepTime({ hour: 9, minute: 0 }, 1)).toEqual({ hour: 9, minute: 15 });
    expect(stepTime({ hour: 9, minute: 45 }, 1)).toEqual({ hour: 10, minute: 0 });
    expect(stepTime({ hour: 0, minute: 0 }, -1)).toEqual({ hour: 23, minute: 45 });
    expect(stepTime({ hour: 23, minute: 45 }, 1)).toEqual({ hour: 0, minute: 0 });
    expect(stepTime({ hour: 12, minute: 0 }, 4)).toEqual({ hour: 13, minute: 0 });
  });

  test('formats a 12-hour clock', () => {
    expect(formatTime({ hour: 0, minute: 5 })).toBe('12:05 AM');
    expect(formatTime({ hour: 9, minute: 0 })).toBe('9:00 AM');
    expect(formatTime({ hour: 12, minute: 30 })).toBe('12:30 PM');
    expect(formatTime({ hour: 21, minute: 15 })).toBe('9:15 PM');
  });

  test('every reminder defaults to off with a sensible time', () => {
    for (const r of REMINDERS) {
      const d = defaultReminder(r.key);
      expect(d.enabled).toBe(false);
      expect(d.hour).toBeGreaterThanOrEqual(0);
      expect(d.hour).toBeLessThanOrEqual(23);
    }
  });

  test('unreadable saved values fall back to the default', () => {
    expect(parseReminder('diary', null)).toEqual(defaultReminder('diary'));
    expect(parseReminder('diary', 'garbage')).toEqual(defaultReminder('diary'));
    expect(parseReminder('diary', JSON.stringify({ enabled: true, hour: 25, minute: 0 }))).toEqual(
      defaultReminder('diary'),
    );
    expect(parseReminder('diary', JSON.stringify({ enabled: 'yes', hour: 8, minute: 0 }))).toEqual(
      defaultReminder('diary'),
    );
    expect(parseReminder('diary', serializeReminder({ enabled: true, hour: 8, minute: 30 }))).toEqual({
      enabled: true, hour: 8, minute: 30,
    });
  });
});

describe('when the next reminder arrives', () => {
  const at = (h, m) => new Date(2026, 10, 11, h, m, 0);

  test('a time that has already passed today first arrives tomorrow', () => {
    // The reported case: an 11:00 PM reminder saved at 11:14 PM does nothing until the next evening.
    expect(nextFireDay({ hour: 23, minute: 0 }, at(23, 14))).toBe('tomorrow');
    expect(nextFireDay({ hour: 9, minute: 0 }, at(21, 0))).toBe('tomorrow');
  });

  test('a time still ahead arrives today', () => {
    expect(nextFireDay({ hour: 23, minute: 0 }, at(22, 56))).toBe('today');
    expect(nextFireDay({ hour: 15, minute: 0 }, at(9, 30))).toBe('today');
    expect(nextFireDay({ hour: 0, minute: 15 }, at(0, 0))).toBe('today');
  });

  test('the current minute counts as already reached', () => {
    expect(nextFireDay({ hour: 23, minute: 0 }, at(23, 0))).toBe('tomorrow');
    expect(nextFireDay({ hour: 23, minute: 15 }, at(23, 14))).toBe('today');
  });

  test('midnight reminders', () => {
    expect(nextFireDay({ hour: 0, minute: 0 }, at(23, 59))).toBe('tomorrow');
    expect(nextFireDay({ hour: 0, minute: 0 }, at(0, 0))).toBe('tomorrow');
  });
});

describe('reminder persistence', () => {
  test('defaults to all off, then saves and reads back per reminder', async () => {
    const db = await freshDb();
    const initial = await readReminders(db);
    expect(Object.keys(initial)).toEqual(['diary', 'water', 'habits']);
    expect(Object.values(initial).every((r) => r.enabled === false)).toBe(true);

    await writeReminder(db, 'water', { enabled: true, hour: 16, minute: 30 });
    const after = await readReminders(db);
    expect(after.water).toEqual({ enabled: true, hour: 16, minute: 30 });
    expect(after.diary.enabled).toBe(false);
  });

  test('rejects unknown reminders and invalid times', async () => {
    const db = await freshDb();
    await expect(writeReminder(db, 'nope', { enabled: true, hour: 8, minute: 0 })).rejects.toThrow(/Unknown/);
    await expect(writeReminder(db, 'diary', { enabled: true, hour: 24, minute: 0 })).rejects.toThrow(/valid time/);
    await expect(writeReminder(db, 'diary', { enabled: true, hour: 8, minute: 60 })).rejects.toThrow(/valid time/);
    await expect(writeReminder(db, 'diary', { enabled: true, hour: 8.5, minute: 0 })).rejects.toThrow(/valid time/);
  });
});
