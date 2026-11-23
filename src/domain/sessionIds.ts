import type { SessionLog } from './types';

const whole = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;

/**
 * Session ids made unique whole numbers, every session kept: editing and Health sync find a workout by its id.
 * The first session with an id keeps it; a missing, broken or repeated id (an older version could hand one out
 * twice) gets a new id after every id in use, as does an open workout whose id a session already has.
 * `nextSession` ends above every id, so no id is handed out twice later. Order and everything else are kept.
 */
export function normaliseSessionIds<
  T extends { sessions: SessionLog[]; draft: SessionLog | null; nextSession: number },
>(s: T): T {
  let next = whole(s.nextSession) ? s.nextSession : 0;
  for (const log of s.sessions ?? []) if (whole(log.n)) next = Math.max(next, log.n + 1);
  if (s.draft && whole(s.draft.n)) next = Math.max(next, s.draft.n + 1);
  const seen = new Set<number>();
  let renumbered = false;
  const sessions = (s.sessions ?? []).map((log) => {
    if (whole(log.n) && !seen.has(log.n)) {
      seen.add(log.n);
      return log;
    }
    renumbered = true;
    return { ...log, n: next++ };
  });
  const draft = s.draft && (!whole(s.draft.n) || seen.has(s.draft.n)) ? { ...s.draft, n: next++ } : s.draft;
  if (!renumbered && draft === s.draft && next === s.nextSession) return s;
  return { ...s, sessions: renumbered ? sessions : s.sessions, draft, nextSession: next };
}
