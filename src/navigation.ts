import { router } from 'expo-router';
import { useTheme } from './design/theme';
import { fontFamily } from './design/tokens';

/**
 * Stack header and content styling from the active theme (root and nested stacks). Screens set their `title`
 * and get the native large title on iOS, which collapses into the bar as the screen's scroll view scrolls.
 */
export function useStackOptions() {
  const t = useTheme();
  return {
    headerStyle: { backgroundColor: t.color.background },
    headerTintColor: t.color.text,
    headerTitleStyle: { fontFamily: fontFamily.semibold, color: t.color.text },
    headerLargeTitle: true,
    headerLargeStyle: { backgroundColor: t.color.background },
    headerLargeTitleStyle: { fontFamily: fontFamily.bold, color: t.color.text },
    headerLargeTitleShadowVisible: false,
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
