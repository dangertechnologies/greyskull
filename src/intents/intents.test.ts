import { active } from '../__fixtures__/oneProgram';
import type { ActiveProgram, SessionLog } from '../domain';
import { TEMPLATES } from '../domain';
import { initialState } from '../store';
import { type AppIntentsDeps, handleInvocation } from './handlers';
import { buildCatalogs, nextWorkoutText } from './snapshot';

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

const state = (programs: ActiveProgram[], draft: SessionLog | null = null, confirm = false) => ({
  ...initialState(),
  programs,
  draft,
  nextSession: 12,
  needsWeightConfirm: confirm,
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

  test('weights moved from the old version are not read out as if confirmed', () => {
    expect(nextWorkoutText(state([program('a', 'Alpha')], null, true))).toBe(
      'Open Greyskull LP to confirm your weights.',
    );
  });

  test('every program paused: says so, not that there is no program', () => {
    expect(nextWorkoutText(state([program('a', 'Alpha', { paused: true })]))).toBe(
      'All your programs are paused. Open Greyskull LP to resume one.',
    );
  });

  test('a long program name is cut to 40 characters', () => {
    const text = nextWorkoutText(
      state([program('a', 'A very long program name that goes on and on forever')]),
    );
    expect(text).toMatch(/^A very long program name that goes on a…: /);
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

  test('programs that share a name are told apart by their day, and every title is unique', () => {
    const programs = [
      program('a', 'GZCLP', { position: 0 }),
      program('b', 'gzclp', { position: 0 }),
      program('c', 'Other'),
    ];
    const titles = buildCatalogs(state(programs)).programs.map((p) => p.title);
    expect(titles).toEqual(['GZCLP, Day 1', 'gzclp, Day 1 (2)', 'Other']);
    expect(new Set(titles).size).toBe(3);
  });

  test('the start sentence follows the weight check and an open workout of another program', () => {
    const programs = [program('a', 'Alpha'), program('b', 'Beta')];
    expect(buildCatalogs(state(programs, null, true)).programs[0].metadata?.start).toMatch(
      /confirm your weights/,
    );
    expect(buildCatalogs(state(programs, draftOf('b'))).programs[0].metadata?.start).toMatch(
      /Beta is already in progress/,
    );
  });

  test('every program paused: the default start line says to resume one', () => {
    const { programs: list, next } = buildCatalogs(state([program('a', 'A', { paused: true })]));
    expect(list).toEqual([]);
    expect(next[0].metadata?.start).toBe('All your programs are paused. Open Greyskull LP to resume one.');
  });

  test('no programs: an empty program list and a next answer that says so', () => {
    const { programs: list, next } = buildCatalogs(state([]));
    expect(list).toEqual([]);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'next' });
    expect(next[0].metadata?.text).toMatch(/don't have a program/i);
    expect(next[0].metadata?.start).toMatch(/set one up/i);
  });

  test('carries nothing but program names, day names and weights', () => {
    const { programs: list, next } = buildCatalogs(state([program('a', 'Alpha')]));
    const keys = [...list, ...next].flatMap((e) => Object.keys(e.metadata ?? {}));
    expect(new Set(keys)).toEqual(new Set(['start', 'text']));
  });
});

describe('handling invocations', () => {
  const now = 1_000_000;
  const make = (over: Partial<AppIntentsDeps> = {}) => {
    const navigate = jest.fn();
    const deps: AppIntentsDeps = {
      getState: () => state([program('a', 'Alpha')]),
      navigate,
      current: () => '/',
      now: () => now,
      ...over,
    };
    return { deps, navigate };
  };
  const inv = (name: string, params: Record<string, unknown> = {}, createdAt = now - 1000) => ({
    id: `i-${name}`,
    name,
    params,
    createdAt,
  });

  test('start workout opens the session route and is done', async () => {
    const { deps, navigate } = make();
    expect(await handleInvocation(inv('startWorkout', { programId: 'a' }), deps)).toBe('done');
    expect(navigate).toHaveBeenCalledWith('/session/12?program=a');
  });

  test('start workout with no program parameter', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('startWorkout'), deps);
    expect(navigate).toHaveBeenCalledWith('/session/12?program=a');
  });

  test('start workout while old weights are unconfirmed goes to the confirmation screen', async () => {
    const { deps, navigate } = make({ getState: () => state([program('a', 'Alpha')], null, true) });
    await handleInvocation(inv('startWorkout', { programId: 'a' }), deps);
    expect(navigate).toHaveBeenCalledWith('/setup/confirm');
  });

  test('start workout with another program open goes to that workout, never a second draft', async () => {
    const { deps, navigate } = make({
      getState: () => state([program('a', 'Alpha'), program('b', 'Beta')], draftOf('b')),
    });
    await handleInvocation(inv('startWorkout', { programId: 'a' }), deps);
    expect(navigate).toHaveBeenCalledWith('/session/7');
  });

  test('already on that session: nothing is opened a second time', async () => {
    const { deps, navigate } = make({ current: () => '/session/12' });
    expect(await handleInvocation(inv('startWorkout', { programId: 'a' }), deps)).toBe('done');
    expect(navigate).not.toHaveBeenCalled();
  });

  test('make a program opens the Describe screen with the text prefilled and encoded', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('makeProgram', { text: '3 days & dips, "light"' }), deps);
    expect(navigate).toHaveBeenCalledWith(
      `/generate/describe?text=${encodeURIComponent('3 days & dips, "light"')}`,
    );
  });

  test('make a program strips control and invisible formatting characters', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('makeProgram', { text: 'dips\u0000\n\u202Eand\u0007 rows\u200B' }), deps);
    expect(navigate).toHaveBeenCalledWith(`/generate/describe?text=${encodeURIComponent('dips and rows')}`);
  });

  test('make a program cuts the text to the length the screen accepts', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('makeProgram', { text: 'x'.repeat(900) }), deps);
    expect(decodeURIComponent(String(navigate.mock.calls[0][0]).split('text=')[1])).toHaveLength(500);
  });

  test('make a program with no text still opens the screen', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('makeProgram', { text: 5 }), deps);
    expect(navigate).toHaveBeenCalledWith('/generate/describe');
  });

  test('an invocation older than a minute is dropped without opening anything', async () => {
    const { deps, navigate } = make();
    expect(await handleInvocation(inv('startWorkout', {}, now - 61_000), deps)).toBe('done');
    expect(await handleInvocation(inv('makeProgram', { text: 'x' }, now - 61_000), deps)).toBe('done');
    expect(navigate).not.toHaveBeenCalled();
  });

  test('one just under a minute old is still acted on', async () => {
    const { deps, navigate } = make();
    await handleInvocation(inv('startWorkout', {}, now - 59_000), deps);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  test('an unknown name is left alone', async () => {
    const { deps, navigate } = make();
    expect(await handleInvocation(inv('somethingNew'), deps)).toBe('unknown');
    expect(navigate).not.toHaveBeenCalled();
  });

  test('a navigation failure leaves the invocation pending', async () => {
    const { deps } = make({
      navigate: () => {
        throw new Error('not ready');
      },
    });
    await expect(handleInvocation(inv('startWorkout'), deps)).rejects.toThrow('not ready');
  });
});
