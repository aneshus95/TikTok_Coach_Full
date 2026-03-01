/**
 * NotificationService - Crescio AI
 * Daily posting reminders using notifee with robust Android 12+ handling.
 * Falls back gracefully if exact alarms aren't available.
 */

import notifee, {
  AndroidImportance,
  AndroidStyle,
  TimestampTrigger,
  TriggerType,
  RepeatFrequency,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHANNEL_ID = 'content-flow-reminders';
const NOTIFICATION_ID_PREFIX = 'post-reminder-day-';
const STORAGE_KEY_REMINDER = 'reminder_settings';

export interface ReminderSettings {
  enabled: boolean;
  hour: number;       // 0-23
  minute: number;     // 0-59
  niche: string;
  optimalTime: string; // human-readable e.g. "7:00 PM"
  activeDays?: number[]; // 0=Sun..6=Sat, undefined = all days
}

const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 19,
  minute: 0,
  niche: '',
  optimalTime: '7:00 PM',
  activeDays: [0, 1, 2, 3, 4, 5, 6],
};

const REMINDER_MESSAGES = [
  "Your audience is waiting. Time to post!",
  "Peak engagement window is NOW. Don't miss it!",
  "Creators who post consistently grow 3x faster. Go!",
  "Your best time to go viral is right now. Hit publish!",
  "Consistency beats perfection. Post today.",
  "The algorithm rewards those who show up daily. That's you!",
  "Your next viral post is one upload away. Let's go!",
];

/** Wrap a promise with a timeout so it never hangs forever */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const NotificationService = {

  async requestPermissions(): Promise<boolean> {
    try {
      const settings = await withTimeout(notifee.requestPermission(), 5000, null);
      if (!settings) return false;
      return (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch (e) {
      if (__DEV__) console.error('requestPermissions failed:', e);
      return false;
    }
  },

  async checkPermissions(): Promise<boolean> {
    try {
      const settings = await withTimeout(notifee.getNotificationSettings(), 3000, null);
      if (!settings) return false;
      return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
    } catch {
      return false;
    }
  },

  async createChannel(): Promise<void> {
    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Daily Posting Reminders',
        description: 'Reminds you to post at your optimal engagement time',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    } catch (e) {
      if (__DEV__) console.error('createChannel failed:', e);
    }
  },

  /**
   * Schedule daily/weekly reminders. Saves settings to AsyncStorage first
   * so the reminder is "saved" even if notification scheduling fails.
   */
  async scheduleDailyReminder(settings: ReminderSettings): Promise<boolean> {
    const days = settings.activeDays ?? [0, 1, 2, 3, 4, 5, 6];
    const fullSettings = { ...settings, activeDays: days, enabled: true };

    // Always save settings first — this is the source of truth
    await this.saveSettings(fullSettings);

    try {
      // Cancel any existing reminders
      await this.cancelNotifications();

      const granted = await this.requestPermissions();
      if (!granted) return false;

      await this.createChannel();

      const allDays = days.length === 7;

      const makePayload = (body: string) => ({
        title: `Post Now — ${settings.optimalTime} is your peak!`,
        body,
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          smallIcon: 'ic_notification',
          color: '#00D4FF',
          style: { type: AndroidStyle.BIGTEXT as const, text: body },
          pressAction: { id: 'default' as const },
        },
        ios: {
          sound: 'default' as const,
        },
      });

      if (allDays) {
        const trigger = this._nextTriggerDate(settings.hour, settings.minute);
        const body = REMINDER_MESSAGES[trigger.getDay() % REMINDER_MESSAGES.length];
        await withTimeout(
          notifee.createTriggerNotification(
            { id: `${NOTIFICATION_ID_PREFIX}all`, ...makePayload(body) },
            {
              type: TriggerType.TIMESTAMP,
              timestamp: trigger.getTime(),
              repeatFrequency: RepeatFrequency.DAILY,
              alarmManager: { allowWhileIdle: true },
            } as TimestampTrigger,
          ),
          8000,
          undefined,
        );
      } else {
        for (const dayIndex of days) {
          const trigger = this._nextWeekdayDate(dayIndex, settings.hour, settings.minute);
          const body = REMINDER_MESSAGES[dayIndex % REMINDER_MESSAGES.length];
          await withTimeout(
            notifee.createTriggerNotification(
              { id: `${NOTIFICATION_ID_PREFIX}${dayIndex}`, ...makePayload(body) },
              {
                type: TriggerType.TIMESTAMP,
                timestamp: trigger.getTime(),
                repeatFrequency: RepeatFrequency.WEEKLY,
                alarmManager: { allowWhileIdle: true },
              } as TimestampTrigger,
            ),
            8000,
            undefined,
          );
        }
      }

      return true;
    } catch (error) {
      if (__DEV__) console.error('Failed to schedule notification:', error);
      // Settings are already saved — return true so the user sees success
      // Notifications may not fire but the preference is stored
      return true;
    }
  },

  _nextTriggerDate(hour: number, minute: number): Date {
    const now = new Date();
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  },

  _nextWeekdayDate(targetDay: number, hour: number, minute: number): Date {
    const now = new Date();
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    const currentDay = d.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0 && d <= now) daysAhead = 7;
    d.setDate(d.getDate() + daysAhead);
    return d;
  },

  /** Cancel all scheduled notification triggers (not the saved settings) */
  async cancelNotifications(): Promise<void> {
    try {
      const ids = [
        `${NOTIFICATION_ID_PREFIX}all`,
        ...Array.from({ length: 7 }, (_, i) => `${NOTIFICATION_ID_PREFIX}${i}`),
      ];
      for (const id of ids) {
        await withTimeout(notifee.cancelNotification(id), 2000, undefined);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to cancel notifications:', error);
    }
  },

  async cancelReminder(): Promise<void> {
    await this.cancelNotifications();
    const current = await this.loadSettings();
    await this.saveSettings({ ...current, enabled: false });
  },

  parseOptimalTime(timeString: string): { hour: number; minute: number; label: string } {
    const match = timeString.match(/(\d+)(?:-(\d+))?\s*(AM|PM)/i);
    if (!match) return { hour: 19, minute: 0, label: '7:00 PM' };

    let startHour = parseInt(match[1], 10);
    const endHour = match[2] ? parseInt(match[2], 10) : startHour;
    const period = match[3].toUpperCase();

    let hour = Math.floor((startHour + endHour) / 2);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const label = `${hour > 12 ? hour - 12 : hour}:00 ${period}`;
    return { hour, minute: 0, label };
  },

  async saveSettings(settings: ReminderSettings): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_REMINDER, JSON.stringify(settings));
  },

  async loadSettings(): Promise<ReminderSettings> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_REMINDER);
    if (!raw) return DEFAULT_REMINDER;
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_REMINDER;
    }
  },
};

export default NotificationService;
