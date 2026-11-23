import { active } from '../__fixtures__/oneProgram';
import { type SessionLog, TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { ALL_PAUSED_NEXT, CONFIRM_NEXT, EMPTY_NEXT, nextWorkoutProps } from './summary';

describe('widget text for states without a workout to show', () => {
  test('no program asks to set one up', () => {
    expect(nextWorkoutProps(initialState())).toEqual(EMPTY_NEXT);
  });

  test('every program paused says so and asks to resume one, not to set up', () => {
    const s = { ...initialState(), programs: [{ ...active(TEMPLATES.base), paused: true }] };
    const p = nextWorkoutProps(s);
    expect(p).toEqual(ALL_PAUSED_NEXT);
    expect(`${p.title} ${p.subtitle}`).toMatch(/paused/i);
    expect(p.subtitle).toMatch(/resume/i);
    expect(p.ready).toBe(false);
  });

  test('weights from the old version are not shown until they are confirmed', () => {
    const s = { ...initialState(), programs: [active(TEMPLATES.base)], needsWeightConfirm: true };
    const p = nextWorkoutProps(s);
    expect(p).toEqual(CONFIRM_NEXT);
    expect(p.lines).toEqual([]);
  });
});

describe('the workout the widget shows is the one that will start', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-06-30T12:00:00Z');
  const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
  const squat = { weightKg: 100, startKg: 100, fails: 0 };
  const past = (days: number): SessionLog => ({
    n: 1,
    dayName: 'Old',
    startedAt: ago(days),
    finishedAt: ago(days),
    results: { BARBELL_SQUAT: { weightKg: 100, sets: [{ target: 5, reps: 5 }] } },
    order: ['BARBELL_SQUAT'],
  });
  const base = (days: number) => ({
    ...initialState(),
    programs: [active(TEMPLATES.base, 0, { BARBELL_SQUAT: squat })],
    sessions: [past(days)],
  });

  test('no draft: after a 30-day gap the preview is eased and says so', () => {
    const p = nextWorkoutProps(base(30), NOW);
    expect(p.lines).toContain('Squat 80 kg');
    expect(p.subtitle).toMatch(/eased/);
  });

  test('no draft: a recent session, or ease-back switched off, shows the stored weight', () => {
    expect(nextWorkoutProps(base(3), NOW).lines).toContain('Squat 100 kg');
    expect(nextWorkoutProps({ ...base(30), breakDeload: false }, NOW).lines).toContain('Squat 100 kg');
    expect(nextWorkoutProps(base(3), NOW).subtitle).not.toMatch(/eased/);
  });

  test('in progress: the lines are the draft weights, eased after a break and changed by setDraftWeight', () => {
    useStore.setState({ ...base(30), hydrated: true, draft: null });
    const id = useStore.getState().programs[0].id;
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      useStore.getState().startSession(id);
      const eased = nextWorkoutProps(useStore.getState(), NOW);
      expect(eased.inProgress).toBe(true);
      expect(eased.lines).toContain('Squat 80 kg');
      expect(eased.subtitle).toMatch(/eased/);
      useStore.getState().setDraftWeight('BARBELL_SQUAT', 70);
      expect(nextWorkoutProps(useStore.getState(), NOW).lines).toContain('Squat 70 kg');
    } finally {
      jest.useRealTimers();
    }
  });
});
