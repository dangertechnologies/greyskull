import { router } from 'expo-router';
import { colors } from './theme';

/** Shared stack styling (root and nested stacks). */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitle: '',
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
} as const;

/** Pop the stack, or go to `fallback` when this screen was opened directly (deep link, restored state). */
export function goBackOr(fallback: '/' | '/exercises'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Back to the Home that is already in the stack (or Home as the only screen); never stacks a second Home. */
export function goHome(): void {
  router.dismissTo('/');
}
