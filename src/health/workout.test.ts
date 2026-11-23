import type { ActiveProgram, SessionLog } from '../domain';
import { isSyncable, recordId, toWorkout } from './workout';

const log = (patch: Partial<SessionLog> = {}): SessionLog => ({
  n: 7,
  dayName: 'Day A',
  startedAt: '2026-11-20T08:00:00.000Z',
  finishedAt: '2026-11-20T08:50:00.000Z',
  results: {},
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
});
