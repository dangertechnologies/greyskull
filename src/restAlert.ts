import * as Notifications from 'expo-notifications';

/** Ask once (when a rest starts) so the alert can fire while the app is in the background. */
export async function ensureRestAlertPermission(): Promise<boolean> {
  try {
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
    if (!(await Notifications.getPermissionsAsync()).granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: 'Rest over', body: 'Time for your next set.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, seconds) },
    });
  } catch {
    return null;
  }
}

export async function cancelRestAlert(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing to cancel.
  }
}
