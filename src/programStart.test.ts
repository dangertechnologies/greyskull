import { active } from './__fixtures__/oneProgram';
import type { ActiveProgram, SessionLog } from './domain';
import { TEMPLATES } from './domain';
import { pickProgram, startRoute, WEIGHT_CONFIRM_ROUTE } from './programStart';
import { initialState } from './store';

const program = (id: string, name: string, extra: Partial<ActiveProgram> = {}): ActiveProgram => ({
  ...active(TEMPLATES.base, 0, {}),
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

describe('startRoute: where Start goes', () => {
  const programs = [program('a', 'Alpha'), program('b', 'Beta'), program('p', 'Paused', { paused: true })];

  test('the next session of the program, when nothing is open', () => {
    expect(startRoute(state(programs), 'b')).toMatchObject({
      kind: 'new',
      route: '/session/12?program=b',
      note: 'Starting Beta, Day 1.',
    });
  });
  test("the program's own open workout is resumed", () => {
    expect(startRoute(state(programs, draftOf('b')), 'b')).toMatchObject({
      kind: 'resume',
      route: '/session/7?program=b',
      note: 'Resuming Beta, Day 1.',
    });
  });
  test("another program's open workout is opened instead, and the note says so", () => {
    expect(startRoute(state(programs, draftOf('a')), 'b')).toEqual({
      kind: 'other',
      route: '/session/7',
      note: "Alpha is already in progress, so I'm opening that instead of Beta.",
    });
  });
  test('no program given: the open workout, else the first program that is not paused', () => {
    expect(startRoute(state(programs)).route).toBe('/session/12?program=a');
    expect(startRoute(state(programs, draftOf('b'))).route).toBe('/session/7?program=b');
  });
  test('while weights from the old version are unconfirmed, Start goes to the confirmation screen', () => {
    const r = startRoute(state(programs, null, true), 'a');
    expect(r).toMatchObject({ kind: 'confirm', route: WEIGHT_CONFIRM_ROUTE });
    expect(r.note).toMatch(/confirm your weights/i);
    // The gate comes before an open workout too: the same screen Today redirects to.
    expect(startRoute(state(programs, draftOf('b'), true), 'a').route).toBe(WEIGHT_CONFIRM_ROUTE);
  });
  test('no program: Today, and the note says to set one up', () => {
    expect(startRoute(state([]))).toMatchObject({ kind: 'none', route: '/' });
    expect(startRoute(state([])).note).toMatch(/don't have a program yet/i);
  });
  test('every program paused: Today, and the note says to resume one', () => {
    const paused = [program('a', 'A', { paused: true }), program('b', 'B', { paused: true })];
    expect(startRoute(state(paused))).toEqual({
      kind: 'none',
      route: '/',
      note: 'All your programs are paused. Open Greyskull LP to resume one.',
    });
  });
  test('a paused or unknown program: Today, nothing started', () => {
    expect(startRoute(state(programs), 'p')).toMatchObject({ kind: 'none', route: '/' });
    expect(startRoute(state(programs), 'p').note).toMatch(/Paused is paused/);
    expect(startRoute(state(programs), 'gone')).toMatchObject({ kind: 'none', route: '/' });
  });
  test('names in notes are cut to 40 characters', () => {
    const long = 'A very long program name that goes on and on forever';
    const note = startRoute(state([program('a', long)]), 'a').note;
    expect(note).not.toContain(long);
    expect(note).toContain('A very long program name that goes on a…');
  });
  test('pickProgram: the open workout, else the first not paused', () => {
    const ps = [program('a', 'A', { paused: true }), program('b', 'B'), program('c', 'C')];
    expect(pickProgram(state(ps))?.id).toBe('b');
    expect(pickProgram(state(ps, draftOf('c')))?.id).toBe('c');
    expect(pickProgram(state([program('a', 'A', { paused: true })]))).toBeUndefined();
  });
});
