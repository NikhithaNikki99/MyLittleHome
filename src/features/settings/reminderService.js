// Reminder choices persisted in app_settings (db-first, no native modules, so it is unit-testable).
import { getAllSettings, setSetting } from '../../database/repositories/settingsRepository';
import { ValidationError } from '../../utils/errors';
import { REMINDERS, parseReminder, reminderById, serializeReminder } from './reminderLogic';

export async function readReminders(db) {
  const settings = await getAllSettings(db);
  return Object.fromEntries(REMINDERS.map((r) => [r.key, parseReminder(r.key, settings[`reminder_${r.key}`])]));
}

export async function writeReminder(db, key, value) {
  if (!reminderById(key)) throw new ValidationError('Unknown reminder.');
  const { hour, minute } = value;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new ValidationError('Choose a valid time.');
  }
  await setSetting(db, `reminder_${key}`, serializeReminder(value));
}
