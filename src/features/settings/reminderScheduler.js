// Thin wrapper over expo-notifications (SDK 57 daily trigger). Local notifications only; nothing
// leaves the phone. Permission is requested only when the user turns a reminder on.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ValidationError } from '../../utils/errors';
import { notificationIdentifier, reminderById } from './reminderLogic';

const CHANNEL_ID = 'reminders';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gentle reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return Boolean(asked.granted);
}

export async function cancelReminder(key) {
  await Notifications.cancelScheduledNotificationAsync(notificationIdentifier(key));
}

// Replaces any existing schedule for this reminder. Throws ValidationError if permission is denied.
export async function scheduleReminder(key, { hour, minute }) {
  const reminder = reminderById(key);
  if (!reminder) throw new ValidationError('Unknown reminder.');
  if (!(await ensureNotificationPermission())) {
    throw new ValidationError('Notifications are turned off for this app. You can allow them in your phone settings.');
  }
  await ensureChannel();
  await cancelReminder(key);
  await Notifications.scheduleNotificationAsync({
    identifier: notificationIdentifier(key),
    content: { title: reminder.title, body: reminder.body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
}
