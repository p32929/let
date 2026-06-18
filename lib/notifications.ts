// Daily reminder support.
//
// expo-notifications is a NATIVE module: it only works in a real build
// (dev build / APK / IPA / web), not necessarily in Expo Go. We load it
// lazily inside try/catch so that if it isn't installed/available yet, the
// rest of the app keeps working and reminders simply stay off.

import { Platform } from 'react-native';
import { storage } from './storage';

const REMINDER_ENABLED_KEY = 'reminder-enabled';
const REMINDER_TIME_KEY = 'reminder-time'; // stored as "HH:MM"

export const DEFAULT_REMINDER_TIME = { hour: 20, minute: 0 }; // 8:00 PM

type Notifications = typeof import('expo-notifications');

// Returns the native module, or null if it can't be loaded (e.g. not installed).
async function loadNotifications(): Promise<Notifications | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

export async function isReminderEnabled(): Promise<boolean> {
  try {
    return (await storage.getItem(REMINDER_ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function getReminderTime(): Promise<{ hour: number; minute: number }> {
  try {
    const raw = await storage.getItem(REMINDER_TIME_KEY);
    if (raw) {
      const [h, m] = raw.split(':').map((n) => parseInt(n, 10));
      if (!isNaN(h) && !isNaN(m)) return { hour: h, minute: m };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_REMINDER_TIME;
}

/**
 * Turn the daily reminder on or off. When enabling, asks for permission and
 * schedules a repeating daily notification. Returns true on success.
 */
export async function setReminder(
  enabled: boolean,
  time: { hour: number; minute: number } = DEFAULT_REMINDER_TIME
): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;

  try {
    // Always clear any previously scheduled reminder first.
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!enabled) {
      await storage.setItem(REMINDER_ENABLED_KEY, 'false');
      return true;
    }

    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      await storage.setItem(REMINDER_ENABLED_KEY, 'false');
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'LET — time to track your day',
        body: "Don't forget to log today's events.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
      },
    });

    await storage.setItem(REMINDER_ENABLED_KEY, 'true');
    await storage.setItem(REMINDER_TIME_KEY, `${time.hour}:${time.minute}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-apply the saved reminder on app launch so it keeps firing after a reboot
 * or reinstall. Safe to call unconditionally — it no-ops if reminders are off
 * or the native module is unavailable.
 */
export async function syncReminderOnLaunch(): Promise<void> {
  if (Platform.OS === 'web') return; // browsers don't run scheduled local notifications here
  const enabled = await isReminderEnabled();
  if (!enabled) return;
  const time = await getReminderTime();
  await setReminder(true, time);
}
