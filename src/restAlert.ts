// Loaded lazily: importing expo-notifications logs a warning in Expo Go on Android, and most sessions never need it.
const notifications = () => import('expo-notifications');

/** Ask once (when a rest starts) so the alert can fire while the app is in the background. */
export async function ensureRestAlertPermission(): Promise<boolean> {
  try {
    const Notifications = await notifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Local "Rest over" notification; resolves to its id, or null when notifications are unavailable. */
export async function scheduleRestAlert(seconds: number): Promise<string | null> {
  try {
    const Notifications = await notifications();
    if (!(await Notifications.getPermissionsAsync()).granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, seconds),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestAlert(id: string): Promise<void> {
  try {
    await (await notifications()).cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing to cancel.
  }
}

const TIMER_PREFIX = 'workout-timer-';
/** iOS keeps at most 64 pending notifications per app; leave room for the rest alert. */
const MAX_TIMER_ALERTS = 60;

/**
 * Local notifications at each boundary of an EMOM or interval timer, for when the app is in the background.
 * Replaces any timer alerts already scheduled. Their identifiers share one prefix, so `cancelTimerAlerts` finds
 * them even after a relaunch. Resolves to false when notifications are unavailable or denied.
 */
export async function scheduleTimerAlerts(
  alerts: { inS: number; title: string; body: string }[],
): Promise<boolean> {
  await cancelTimerAlerts();
  try {
    const Notifications = await notifications();
    if (!(await Notifications.getPermissionsAsync()).granted) return false;
    for (const [i, alert] of alerts.slice(0, MAX_TIMER_ALERTS).entries()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${TIMER_PREFIX}${i}`,
        content: { title: alert.title, body: alert.body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(alert.inS)),
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function cancelTimerAlerts(): Promise<void> {
  try {
    const Notifications = await notifications();
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((p) => p.identifier.startsWith(TIMER_PREFIX))
        .map((p) => Notifications.cancelScheduledNotificationAsync(p.identifier)),
    );
  } catch {
    // Nothing to cancel.
  }
}
