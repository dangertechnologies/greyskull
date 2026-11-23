import type { HealthStatus } from './status';

export interface HealthView {
  title: string;
  toggleSubtitle: string;
  permissionLabel: string;
  /** Shown in a warning box when Health cannot be written to. */
  banner: string | null;
  /** Label of the button that opens the system screen, or null when there is nothing to open. */
  settingsButton: string | null;
  exportEnabled: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function describeHealth(input: {
  os: 'ios' | 'android' | string;
  healthSync: boolean;
  status: HealthStatus;
}): HealthView {
  const ios = input.os === 'ios';
  const { permission } = input.status;
  const unavailable = permission === 'unavailable';
  // Health Connect never says "denied": an unanswered permission with sync on means it was taken away.
  const blocked = permission === 'denied' || (permission === 'undetermined' && input.healthSync);
  return {
    title: ios ? 'Apple Health' : 'Health Connect',
    toggleSubtitle: unavailable
      ? 'Not available on this device'
      : blocked
        ? 'Waiting for permission'
        : 'Each finished workout is written once',
    permissionLabel:
      permission === 'granted'
        ? 'Allowed'
        : blocked
          ? 'Not allowed'
          : permission === 'unavailable'
            ? 'Unavailable'
            : permission === 'undetermined'
              ? 'Not asked yet'
              : 'Checking…',
    banner: unavailable
      ? 'Health is not available on this device.'
      : blocked
        ? ios
          ? 'Health access is off for Greyskull. Allow it under Settings, Health, Data Access.'
          : 'Health access is off for Greyskull. Allow it in Health Connect, under App permissions.'
        : null,
    settingsButton: unavailable || !blocked ? null : ios ? 'Open system Settings' : 'Open Health Connect',
    exportEnabled: permission === 'granted',
  };
}

/** "Today 09:12 · 124 workouts", "Failed 22 Nov · will retry on next launch" or "Nothing written yet". */
export function lastSyncLabel(status: HealthStatus, writtenCount: number, now: Date = new Date()): string {
  if (status.lastError)
    return `Failed ${shortDate(new Date(status.lastError.at))} · will retry on next launch`;
  if (!status.lastSyncAt) return 'Nothing written yet';
  const at = new Date(status.lastSyncAt);
  const when = sameDay(at, now)
    ? `Today ${at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : shortDate(at);
  return `${when} · ${writtenCount} ${writtenCount === 1 ? 'workout' : 'workouts'}`;
}
