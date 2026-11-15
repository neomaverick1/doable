import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fromISODate, timeToMin } from './dates';
import type { Task } from './types';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let channelReady = false;

export async function ensureReminderPermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    if (Platform.OS === 'android' && !channelReady) {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Task reminders',
        // eslint-disable-next-line import/namespace -- re-exported enum the import plugin cannot follow
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
      });
      channelReady = true;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** When a task's reminder should fire, or null if it has no time or is in the past. */
export function reminderDate(task: Task, now: Date = new Date()): Date | null {
  if (!task.due || !task.time || task.done) return null;
  const at = fromISODate(task.due);
  const mins = timeToMin(task.time);
  at.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}

export async function scheduleReminder(task: Task): Promise<string | undefined> {
  const when = reminderDate(task);
  if (!when || !remindersSupported) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.durationMin ? `Starting now · ${task.durationMin} min` : 'Starting now',
        data: { taskId: task.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
    });
  } catch {
    return undefined;
  }
}

export async function cancelReminder(id: string | undefined): Promise<void> {
  if (!id || !remindersSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or removed.
  }
}
