import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '../design/haptics';

const KEEP_AWAKE_TAG = 'hold-stopwatch';

export interface Stopwatch {
  /** Whole seconds held so far. */
  seconds: number;
  running: boolean;
  /** Start, or resume after a pause. */
  start(): void;
  pause(): void;
  reset(): void;
}

/**
 * A stopwatch for timed holds. Time comes from timestamps (the interval only redraws), so a hold keeps counting
 * while the app is in the background. Buzzes once when `targetS` is reached and keeps the screen awake only while
 * running.
 */
export function useStopwatch(targetS: number | null): Stopwatch {
  // `at`: when the current run started; `banked`: milliseconds from runs before a pause.
  const [clock, setClock] = useState<{ at: number | null; banked: number }>({ at: null, banked: 0 });
  const [now, setNow] = useState(() => Date.now());
  const running = clock.at !== null;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      clearInterval(id);
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running]);

  const elapsed = clock.banked + (clock.at === null ? 0 : Math.max(0, now - clock.at));
  const seconds = Math.floor(elapsed / 1000);

  const buzzed = useRef(false);
  useEffect(() => {
    if (running && targetS !== null && seconds >= targetS && !buzzed.current) {
      buzzed.current = true;
      haptics.success();
    }
  }, [running, seconds, targetS]);

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock((c) => (c.at === null ? { ...c, at: t } : c));
  }, []);
  const pause = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setClock((c) => (c.at === null ? c : { at: null, banked: c.banked + Math.max(0, t - c.at) }));
  }, []);
  const reset = useCallback(() => {
    buzzed.current = false;
    setClock({ at: null, banked: 0 });
  }, []);

  return { seconds, running, start, pause, reset };
}
