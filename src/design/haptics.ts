import * as Haptics from 'expo-haptics';

let enabled = true;

/** Wired to the `hapticsEnabled` setting by the ThemeProvider. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

const run = (fn: () => Promise<void>): void => {
  if (enabled) fn().catch(() => undefined);
};

export const haptics = {
  /** Stepper step, chip toggle. */
  tick: () => run(() => Haptics.selectionAsync()),
  /** A set logged, Done pressed. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Workout finished, rest over. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Destructive confirm. */
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
