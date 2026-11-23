import type { ActiveProgram, SessionLog } from '../domain';
import { isEmpty, isSyncable, MAX_WORKOUT_MS, recordId, toWorkout } from './workout';

const log = (patch: Partial<SessionLog> = {}): SessionLog => ({
  n: 7,
  dayName: 'Day A',
  startedAt: '2026-11-20T08:00:00.000Z',
  finishedAt: '2026-11-20T08:50:00.000Z',
  results: { SQUAT: { weightKg: 60, sets: [{ target: 5, reps: 5 }] } },
  order: [],
  programId: 'p1',
  programName: 'Greyskull LP',
  ...patch,
});
const program = (template: string): ActiveProgram =>
  ({ id: 'p1', name: 'My plan', template, days: [], sessionsPerWeek: 3, lifts: {}, position: 0 }) as never;

describe('health workout', () => {
  it('uses a stable id built from the start time and session number', () => {
    expect(recordId(log())).toBe('greyskull-2026-11-20T08:00:00.000Z-7');
  });

  it('titles the workout with the program and day names', () => {
    expect(toWorkout(log(), [program('base')], 1)?.title).toBe('Greyskull LP · Day A');
    expect(toWorkout(log({ programName: undefined }), [program('base')], 1)?.title).toBe('My plan · Day A');
    expect(toWorkout(log({ programName: undefined, programId: undefined }), [], 1)?.title).toBe('Day A');
  });

  it('is traditional strength training unless the plan is calisthenics or skills', () => {
    expect(toWorkout(log(), [program('base')], 1)?.activity).toBe('strength');
    expect(toWorkout(log(), [program('custom')], 1)?.activity).toBe('strength');
    expect(toWorkout(log({ programId: undefined }), [], 1)?.activity).toBe('strength');
  });

  it('is functional strength training for calisthenics and skills plans', () => {
    const { PLANS } = require('../config/plans') as typeof import('../config/plans');
    for (const category of ['calisthenics', 'skills']) {
      const plan = PLANS.find((p) => p.category === category);
      expect(plan).toBeDefined();
      expect(toWorkout(log(), [program(plan?.id ?? '')], 1)?.activity).toBe('functional');
    }
  });

  describe('a program of your own has no plan category: its exercises decide', () => {
    const { builtInExercises } = require('../catalog') as typeof import('../catalog');
    const exercises = builtInExercises();
    const own = (slots: ActiveProgram['days'][number]['slots']): ActiveProgram =>
      ({ ...program('custom'), days: [{ name: 'A', slots }] }) as never;
    const activity = (p: ActiveProgram) => toWorkout(log(), [p], 1, exercises)?.activity;

    it('is functional when every slot is a ladder or a bodyweight exercise', () => {
      expect(activity(own([{ exercise: 'CAL_SCAPULAR_PULL', scheme: '3x5-8', ladder: 'rr_pullup' }]))).toBe(
        'functional',
      );
      expect(activity(own([{ exercise: 'CHINUPS', scheme: '3x5' }]))).toBe('functional');
    });

    it('is traditional strength training when any slot is loaded, or the program is empty', () => {
      expect(
        activity(
          own([
            { exercise: 'CHINUPS', scheme: '3x5' },
            { exercise: 'BARBELL_SQUAT', scheme: '3x5' },
          ]),
        ),
      ).toBe('strength');
      expect(activity(own([]))).toBe('strength');
    });
  });

  it('carries the version and the times', () => {
    const w = toWorkout(log(), [program('base')], 42);
    expect(w).toMatchObject({ id: 'greyskull-2026-11-20T08:00:00.000Z-7', version: 42 });
    expect(w?.start.toISOString()).toBe('2026-11-20T08:00:00.000Z');
    expect(w?.end.toISOString()).toBe('2026-11-20T08:50:00.000Z');
  });

  it('never ends a workout before it starts', () => {
    const w = toWorkout(log({ finishedAt: '2026-11-20T07:00:00.000Z' }), [], 1);
    expect(w && w.end > w.start).toBe(true);
  });

  it('syncs only finished, non-skipped logs', () => {
    expect(isSyncable(log())).toBe(true);
    expect(isSyncable(log({ finishedAt: undefined }))).toBe(false);
    expect(isSyncable(log({ skipped: true }))).toBe(false);
    expect(toWorkout(log({ skipped: true }), [], 1)).toBeNull();
  });

  it('clamps a very long workout to six hours', () => {
    const w = toWorkout(log({ finishedAt: '2026-11-22T08:00:00.000Z' }), [], 1);
    expect(w && w.end.getTime() - w.start.getTime()).toBe(MAX_WORKOUT_MS);
    expect(MAX_WORKOUT_MS).toBe(6 * 3_600_000);
  });

  it('does not write a finish with no set done', () => {
    const none = log({ results: { SQUAT: { weightKg: 60, sets: [{ target: 5, reps: 0 }] } } });
    expect(isEmpty(none)).toBe(true);
    expect(isEmpty(log({ results: {} }))).toBe(true);
    expect(isEmpty(log())).toBe(false);
    expect(toWorkout(none, [], 1)).toBeNull();
  });

  it('cuts the title to 80 characters and strips control characters', () => {
    const w = toWorkout(log({ programName: `A\u0000B\n${'x'.repeat(200)}` }), [], 1);
    expect(w?.title.length).toBeLessThanOrEqual(80);
    expect([...(w?.title ?? '')].some((c) => c.charCodeAt(0) < 32)).toBe(false);
    expect(w?.title.startsWith('AB')).toBe(true);
  });
});
