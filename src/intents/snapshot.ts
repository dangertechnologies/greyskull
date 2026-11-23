import type { AppIntentEntity } from 'expo-app-intents';
import type { AppState } from '../domain';
import { sessionFor } from '../domain';
import { ALL_PAUSED, CONFIRM_WEIGHTS, NO_PROGRAM, pickProgram, spoken, startRoute } from '../programStart';
import { nextWorkoutProps } from '../widgets/summary';

type State = Pick<
  AppState,
  'programs' | 'exercises' | 'inventory' | 'unit' | 'draft' | 'nextSession' | 'needsWeightConfirm'
>;

/** Catalog kinds; the Swift side (app-intents/WorkoutSnapshot.swift) reads the same strings. */
export const PROGRAM_KIND = 'program';
export const NEXT_KIND = 'nextWorkout';
export const NEXT_ID = 'next';

/** The spoken answer to "what's my next workout": the widget's text with the program name in front. */
export function nextWorkoutText(s: State): string {
  if (s.programs.length === 0) return NO_PROGRAM;
  // Weights moved from the old version may be wrong until the person has checked them.
  if (s.needsWeightConfirm) return CONFIRM_WEIGHTS;
  const program = pickProgram(s);
  if (!program) return ALL_PAUSED;
  const next = nextWorkoutProps(s);
  const lines = next.lines.length ? ` ${next.lines.join(', ')}.` : '';
  return `${next.inProgress ? 'In progress. ' : ''}${spoken(program.name)}: ${next.title}, ${next.subtitle}.${lines}`;
}

/**
 * What the intents may read while the app is not running: program names with their day, and two sentences.
 * Plain text only; nothing about the person beyond program names and weights. Programs that share a name get
 * their day in the title, so each entity can be told apart when Siri lists them.
 */
export function buildCatalogs(s: State): { programs: AppIntentEntity[]; next: AppIntentEntity[] } {
  const active = s.programs.filter((p) => !p.paused);
  const count = new Map<string, number>();
  for (const p of active) count.set(p.name.toLowerCase(), (count.get(p.name.toLowerCase()) ?? 0) + 1);
  const taken = new Set<string>();
  const programs = active.map((p) => {
    const day = sessionFor(p).dayName;
    let title = (count.get(p.name.toLowerCase()) ?? 0) > 1 ? `${p.name}, ${day}` : p.name;
    for (let n = 2; taken.has(title.toLowerCase()); n++) title = `${p.name}, ${day} (${n})`;
    taken.add(title.toLowerCase());
    return { id: p.id, title, subtitle: day, metadata: { start: startRoute(s, p.id).note } };
  });
  return {
    programs,
    next: [
      {
        id: NEXT_ID,
        title: 'Next workout',
        hideInSpotlight: true,
        metadata: { text: nextWorkoutText(s), start: startRoute(s).note },
      },
    ],
  };
}
