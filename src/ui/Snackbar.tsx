import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../design/theme';
import { Text } from './Text';

interface SnackbarOptions {
  message: string;
  action?: { label: string; onPress(): void };
  durationMs?: number;
}

const Ctx = createContext<{ show(options: SnackbarOptions): void } | null>(null);

/** A message with an optional action (Undo) at the bottom of the screen for a few seconds. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<SnackbarOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);
  const show = useCallback(
    (options: SnackbarOptions) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(options);
      timer.current = setTimeout(dismiss, options.durationMs ?? 5000);
    },
    [dismiss],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {current ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: t.space[4],
            right: t.space[4],
            bottom: insets.bottom + 96,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space[4],
            padding: t.space[4],
            borderRadius: t.radius.lg,
            backgroundColor: t.color.surfaceRaised,
            borderWidth: 1,
            borderColor: t.color.border,
          }}
        >
          <Text style={{ flex: 1 }}>{current.message}</Text>
          {current.action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={current.action.label}
              hitSlop={8}
              onPress={() => {
                current.action?.onPress();
                dismiss();
              }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: t.space[2] }}
            >
              <Text variant="bodyStrong" color="accent">
                {current.action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

export function useSnackbar(): { show(options: SnackbarOptions): void } {
  return useContext(Ctx) ?? { show: () => undefined };
}
