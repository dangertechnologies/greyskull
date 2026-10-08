import { colors } from './theme';

/** Shared stack styling (root and nested stacks). */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitle: '',
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
} as const;
