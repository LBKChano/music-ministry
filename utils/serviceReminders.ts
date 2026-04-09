/**
 * Service Reminder Notifications
 *
 * Checks upcoming services against the church's notification_hours settings
 * and schedules local expo-notifications for the current user.
 *
 * This runs client-side on app open. It uses AsyncStorage to track which
 * (service, hoursBeforeWindow) pairs have already been notified so we don't
 * spam the user on every app open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Storage key prefix for sent-notification deduplication
const SENT_KEY_PREFIX = 'service_reminder_sent_';

/**
 * Returns a deduplication key for a given service + hours-before window.
 * e.g. "service_reminder_sent_abc123_24" means we already sent the 24h reminder for service abc123.
 */
function sentKey(serviceId: string, hoursWindow: number): string {
  return `${SENT_KEY_PREFIX}${serviceId}_${hoursWindow}`;
}

/**
 * Check if we already sent this reminder (to avoid re-sending on every app open).
 */
async function alreadySent(serviceId: string, hoursWindow: number): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(sentKey(serviceId, hoursWindow));
    return value === '1';
  } catch {
    return false;
  }
}

/**
 * Mark a reminder as sent.
 */
async function markSent(serviceId: string, hoursWindow: number): Promise<void> {
  try {
    await AsyncStorage.setItem(sentKey(serviceId, hoursWindow), '1');
  } catch (err) {
    console.warn('[ServiceReminders] Failed to mark reminder as sent:', err);
  }
}

/**
 * Clean up old sent-reminder keys for services that are now in the past.
 * Runs opportunistically to prevent AsyncStorage bloat.
 */
export async function cleanupOldReminderKeys(pastServiceIds: string[]): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const oldKeys = allKeys.filter(k => {
      if (!k.startsWith(SENT_KEY_PREFIX)) return false;
      // Extract serviceId from key: "service_reminder_sent_{serviceId}_{hours}"
      const withoutPrefix = k.slice(SENT_KEY_PREFIX.length);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const serviceId = withoutPrefix.slice(0, lastUnderscore);
      return pastServiceIds.includes(serviceId);
    });
    if (oldKeys.length > 0) {
      await AsyncStorage.multiRemove(oldKeys);
      console.log('[ServiceReminders] Cleaned up', oldKeys.length, 'old reminder keys');
    }
  } catch (err) {
    console.warn('[ServiceReminders] Cleanup error:', err);
  }
}

/**
 * Schedule a local push notification via expo-notifications.
 */
async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  console.log('[ServiceReminders] Scheduling local notification:', title, '|', body);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: null, // deliver immediately
    });
    console.log('[ServiceReminders] Local notification scheduled successfully');
    return true;
  } catch (err) {
    console.error('[ServiceReminders] Failed to schedule local notification:', err);
    return false;
  }
}

export interface ServiceReminderParams {
  /** Expo push token for the current user (kept for API compatibility, not used for local notifications) */
  expoPushToken?: string | null;
  /** Church name for the notification title */
  churchName: string;
  /** Upcoming services the user is assigned to */
  services: {
    id: string;
    date: string;       // "YYYY-MM-DD"
    time: string | null;
    service_type: string;
    assignments: {
      member_id: string | null;
      role: string;
      person_name: string;
    }[];
  }[];
  /** The current member's church_members.id */
  currentMemberId: string;
  /** Hours before service to send reminders, e.g. [24, 6] */
  notificationHours: number[];
  /** Whether notifications are enabled for this church */
  notificationsEnabled: boolean;
}

/**
 * Main entry point. Call this on app open after services and notification
 * settings are loaded. It will send any due reminders that haven't been sent yet.
 */
export async function checkAndSendServiceReminders(params: ServiceReminderParams): Promise<void> {
  const {
    churchName,
    services,
    currentMemberId,
    notificationHours,
    notificationsEnabled,
  } = params;

  if (!notificationsEnabled) {
    console.log('[ServiceReminders] Notifications disabled for this church, skipping');
    return;
  }

  if (!notificationHours || notificationHours.length === 0) {
    console.log('[ServiceReminders] No notification hours configured, skipping');
    return;
  }

  const now = new Date();
  console.log('[ServiceReminders] Checking service reminders at:', now.toISOString());
  console.log('[ServiceReminders] Notification windows (hours before):', notificationHours);
  console.log('[ServiceReminders] Checking', services.length, 'upcoming services');

  let sentCount = 0;

  for (const service of services) {
    // Build the service datetime. If time is available, combine date + time.
    // service.date is "YYYY-MM-DD", service.time is "HH:MM" or null.
    const dateParts = service.date.split('-');
    if (dateParts.length !== 3) {
      console.warn('[ServiceReminders] Invalid date format for service:', service.id, service.date);
      continue;
    }

    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
    const day = parseInt(dateParts[2], 10);

    let serviceDateTime: Date;
    if (service.time) {
      const timeParts = service.time.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      serviceDateTime = new Date(year, month, day, hours, minutes, 0, 0);
    } else {
      // Default to 9 AM if no time set
      serviceDateTime = new Date(year, month, day, 9, 0, 0, 0);
    }

    // Skip services that are already in the past
    if (serviceDateTime <= now) {
      continue;
    }

    // Check if the current member is assigned to this service
    const myAssignment = service.assignments.find(a => a.member_id === currentMemberId);
    if (!myAssignment) {
      continue;
    }

    const hoursUntilService = (serviceDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    console.log(
      '[ServiceReminders] Service:', service.service_type,
      '| Date:', service.date,
      '| Hours until:', hoursUntilService.toFixed(1),
      '| My role:', myAssignment.role
    );

    // Check each notification window
    for (const windowHours of notificationHours) {
      // We send the reminder when we're within the window.
      // e.g. for a 24h window: send when hoursUntilService is between 0 and 24.
      // We add a 1-hour buffer on the upper end to catch app opens that happen
      // slightly before the exact window boundary.
      const upperBound = windowHours + 1;
      const lowerBound = 0;

      if (hoursUntilService > upperBound || hoursUntilService <= lowerBound) {
        continue;
      }

      // Check deduplication — don't send the same reminder twice
      const alreadyNotified = await alreadySent(service.id, windowHours);
      if (alreadyNotified) {
        console.log(
          '[ServiceReminders] Already sent', windowHours + 'h reminder for service:', service.id
        );
        continue;
      }

      // Build notification text
      const timeDisplay = service.time ? formatTime(service.time) : '';
      const dateDisplay = formatDate(serviceDateTime);
      const reminderLabel = windowHours >= 24
        ? `${Math.round(windowHours / 24)} day${Math.round(windowHours / 24) !== 1 ? 's' : ''}`
        : `${windowHours} hour${windowHours !== 1 ? 's' : ''}`;

      const title = `${churchName} — Service Reminder`;
      const body = timeDisplay
        ? `You're scheduled as ${myAssignment.role} for ${service.service_type} on ${dateDisplay} at ${timeDisplay} (in ~${reminderLabel})`
        : `You're scheduled as ${myAssignment.role} for ${service.service_type} on ${dateDisplay} (in ~${reminderLabel})`;

      const success = await scheduleLocalNotification(title, body, {
        serviceId: service.id,
        serviceType: service.service_type,
        serviceDate: service.date,
        role: myAssignment.role,
      });

      if (success) {
        await markSent(service.id, windowHours);
        sentCount++;
      }
    }
  }

  console.log('[ServiceReminders] Done. Sent', sentCount, 'reminder(s)');
}

function formatTime(timeString: string): string {
  try {
    const parts = timeString.split(':');
    const hour = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
