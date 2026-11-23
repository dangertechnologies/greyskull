import { active } from '../__fixtures__/oneProgram';
import type { ActiveProgram, SessionLog } from '../domain';
import { TEMPLATES } from '../domain';
import { initialState } from '../store';
import { type AppIntentsDeps, handleInvocation, resolveStart } from './handlers';
import { buildCatalogs, nextWorkoutText, pickProgram, startNote } from './snapshot';

const lifts = Object.fromEntries(
  ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS'].map((id) => [
    id,
    { weightKg: 62.5, startKg: 20, fails: 0 },
  ]),
);
const program = (id: string, name: string, extra: Partial<ActiveProgram> = {}): ActiveProgram => ({
  ...active(TEMPLATES.base, 0, lifts),
  id,
  name,
  ...extra,
});
const draftOf = (programId: string, n = 7): SessionLog => ({
  n,
  dayName: 'Day 1',
  startedAt: '',
  results: {},
  order: [],
  programId,
});

const state = (programs: ActiveProgram[], draft: SessionLog | null = null) => ({
  ...initialState(),
  programs,
  draft,
  nextSession: 12,
});

describe('next workout text', () => {
  test('no program: says so', () => {
    expect(nextWorkoutText(state([]))).toMatch(/don't have a program/i);
  });

  test('names the program, the day, the week and each lift with its weight', () => {
    const text = nextWorkoutText(state([program('a', 'Greyskull LP')]));
    expect(text).toMatch(/^Greyskull LP: /);
    expect(text).toMatch(/Week 1/);
    expect(text).toMatch(/Squat .* kg/);
  });

  test('says when the workout is in progress', () => {
    expect(nextWorkoutText(state([program('a', 'A')], draftOf('a')))).toMatch(/in progress/i);
  });

  test('picks the same program as the widget: the open workout, else the first unpaused', () => {
    const programs = [
      program('a', 'Paused', { paused: true }),
      program('b', 'Second'),
      program('c', 'Third'),
    ];
    expect(pickProgram(state(programs))?.id).toBe('b');
    expect(pickProgram(state(programs, draftOf('c')))?.id).toBe('c');
    expect(pickProgram(state([program('a', 'Paused', { paused: true })]))).toBeUndefined();
  });
});

describe('start note', () => {
  const programs = [program('a', 'Alpha'), program('b', 'Beta')];
  test('starting without a workout open', () => {
    expect(startNote(state(programs), programs[0])).toBe('Starting Alpha, Day 1.');
  });
  test('resuming the program own workout', () => {
    expect(startNote(state(programs, draftOf('a')), programs[0])).toBe('Resuming Alpha, Day 1.');
  });
  test("another program's workout is open: says it opens that one instead", () => {
    expect(startNote(state(programs, draftOf('b')), programs[0])).toBe(
      "Beta is already in progress, so I'm opening that instead of Alpha.",
    );
  });
});

describe('catalogs', () => {
  test('lists active, unpaused programs only, with their start note', () => {
    const programs = [program('a', 'Alpha'), program('b', 'Beta', { paused: true }), program('c', 'Gamma')];
    const { programs: list } = buildCatalogs(state(programs));
    expect(list.map((p) => p.id)).toEqual(['a', 'c']);
    expect(list[0]).toMatchObject({ title: 'Alpha', metadata: { start: 'Starting Alpha, Day 1.' } });
  });

  test('keeps a paused program that has the open workout out of the list but the next answer still names it', () => {
    const programs = [program('a', 'Alpha', { paused: true })];
    const { programs: list, next } = buildCatalogs(state(programs, draftOf('a')));
    expect(list).toEqual([]);
    expect(next[0].metadata?.text).toMatch(/^In progress\. Alpha: Day 1,/);
  });

  test('no programs: an empty program list and a next answer that says so', () => {
    const { programs: list, next } = buildCatalogs(state([]));
    expect(list).toEqual([]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'next' });
    expect(next[0].metadata?.text).toMatch(/don't have a program/i);
    expect(next[0].metadata?.start).toMatch(/set one up|set up/i);
  });

  test('carries nothing but program names, day names and weights', () => {
    const { programs: list, next } = buildCatalogs(state([program('a', 'Alpha')]));
    const keys = [...list, ...next].flatMap((e) => Object.keys(e.metadata ?? {}));
    expect(new Set(keys)).toEqual(new Set(['start', 'text']));
  });
});

describe('where starting a workout goes', () => {
  const programs = [program('a', 'Alpha'), program('b', 'Beta'), program('p', 'Paused', { paused: true })];

  test('no workout open: the next session of the program, like the Today screen', () => {
    expect(resolveStart(state(programs), 'b')).toEqual({ route: '/session/12?program=b' });
  });
  test('the program own workout is open: resumes it', () => {
    expect(resolveStart(state(programs, draftOf('b')), 'b')).toEqual({ route: '/session/7?program=b' });
  });
  test("another program's workout is open: opens that one, never starts a second", () => {
    expect(resolveStart(state(programs, draftOf('a')), 'b')).toEqual({ route: '/session/7' });
  });
  test('no program given: the open workout, else the first unpaused program', () => {
    expect(resolveStart(state(programs))).toEqual({ route: '/session/12?program=a' });
    expect(resolveStart(state(programs, draftOf('b')))).toEqual({ route: '/session/7?program=b' });
  });
  test('no program, a paused one, or an unknown id: the Today screen, nothing started', () => {
    expect(resolveStart(state([]))).toEqual({ route: '/' });
    expect(resolveStart(state(programs), 'p')).toEqual({ route: '/' });
    expect(resolveStart(state(programs), 'gone')).toEqual({ route: '/' });
  });
});

describe('handling invocations', () => {
  const now = 1_000_000;
  const make = (over: Partial<AppIntentsDeps> = {}) => {
    const push = jest.fn();
    const deps: AppIntentsDeps = {
      getState: () => state([program('a', 'Alpha')]),
      push,
      now: () => now,
      ...over,
    };
    return { deps, push };
  };
  const inv = (name: string, params: Record<string, unknown> = {}, createdAt = now - 1000) => ({
    id: `i-${name}`,
    name,
    params,
    createdAt,
  });

  test('start workout opens the session route and is done', async () => {
    const { deps, push } = make();
    expect(await handleInvocation(inv('startWorkout', { programId: 'a' }), deps)).toBe('done');
    expect(push).toHaveBeenCalledWith('/session/12?program=a');
  });

  test('start workout with no program parameter', async () => {
    const { deps, push } = make();
    await handleInvocation(inv('startWorkout'), deps);
    expect(push).toHaveBeenCalledWith('/session/12?program=a');
  });

  test('make a program opens the Describe screen with the text prefilled and encoded', async () => {
    const { deps, push } = make();
    await handleInvocation(inv('makeProgram', { text: '3 days & dips, "light"' }), deps);
    expect(push).toHaveBeenCalledWith(
      `/generate/describe?text=${encodeURIComponent('3 days & dips, "light"')}`,
    );
  });

  test('make a program cuts the text to the length the screen accepts', async () => {
    const { deps, push } = make();
    await handleInvocation(inv('makeProgram', { text: 'x'.repeat(900) }), deps);
    expect(decodeURIComponent(String(push.mock.calls[0][0]).split('text=')[1])).toHaveLength(500);
  });

  test('make a program with no text still opens the screen', async () => {
    const { deps, push } = make();
    await handleInvocation(inv('makeProgram', { text: 5 }), deps);
    expect(push).toHaveBeenCalledWith('/generate/describe');
  });

  test('an old invocation is dropped without opening anything', async () => {
    const { deps, push } = make();
    expect(await handleInvocation(inv('startWorkout', {}, now - 6 * 60_000), deps)).toBe('done');
    expect(push).not.toHaveBeenCalled();
  });

  test('an unknown name is left alone', async () => {
    const { deps, push } = make();
    expect(await handleInvocation(inv('somethingNew'), deps)).toBe('unknown');
    expect(push).not.toHaveBeenCalled();
  });

  test('a navigation failure leaves the invocation pending', async () => {
    const { deps } = make({
      push: () => {
        throw new Error('not ready');
      },
    });
    await expect(handleInvocation(inv('startWorkout'), deps)).rejects.toThrow('not ready');
  });
});
