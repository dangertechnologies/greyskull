import { router } from 'expo-router';
import { useTheme } from './design/theme';

/** Stack header and content styling from the active theme (root and nested stacks). */
export function useStackOptions() {
  const t = useTheme();
  return {
    headerStyle: { backgroundColor: t.color.background },
    headerTintColor: t.color.text,
    headerTitle: '',
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: t.color.background },
  } as const;
}

/** Tab routes, for programmatic navigation. */
export const TODAY = '/' as const;

/** Pop the stack, or go to `fallback` when this screen was opened directly (deep link, restored state). */
export function goBackOr(fallback: '/' | '/exercises'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/**
 * Back to the Today tab: pops every screen pushed over the tabs, then selects Today. Never stacks a second
 * copy of Today and works from any tab.
 */
export function goHome(): void {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(TODAY);
}
