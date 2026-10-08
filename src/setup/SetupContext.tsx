import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PlateInventory, PluginId, Program, Rules, Unit } from '../domain';
import { buildProgram, DEFAULT_RULES } from '../domain';
import { useStore } from '../store';

/** Everything the onboarding flow collects. Lives here, not in the store, until the Summary screen. */
export interface SetupDraft {
  unit: Unit;
  inventory: PlateInventory;
  base: Program | null;
  plugins: PluginId[];
  sessionsPerWeek: 2 | 3;
  rules: Rules;
  /** The program as the user is editing it (starts as base + plugins + options). */
  program: Program | null;
  /** Starting weights in kg; lifts without an entry start at the bar. */
  weights: Record<string, number>;
}

interface SetupApi {
  draft: SetupDraft;
  update(patch: Partial<SetupDraft>): void;
  /** Re-derive `program` from base, plugins and options (discards manual day edits). */
  rebuild(patch: Partial<Pick<SetupDraft, 'base' | 'plugins' | 'sessionsPerWeek' | 'rules'>>): void;
}

const Ctx = createContext<SetupApi | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SetupDraft>(() => {
    const { unit, inventory } = useStore.getState();
    return {
      unit,
      inventory,
      base: null,
      plugins: [],
      sessionsPerWeek: 3,
      rules: { ...DEFAULT_RULES },
      program: null,
      weights: {},
    };
  });
  const update = useCallback((patch: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...patch })), []);
  const rebuild = useCallback<SetupApi['rebuild']>((patch) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      return {
        ...next,
        program: next.base
          ? buildProgram(next.base, next.plugins, {
              sessionsPerWeek: next.sessionsPerWeek,
              rules: next.rules,
            })
          : null,
      };
    });
  }, []);
  const value = useMemo(() => ({ draft, update, rebuild }), [draft, update, rebuild]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSetup(): SetupApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSetup must be used inside the setup flow');
  return ctx;
}
