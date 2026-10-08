import { builtInExercises } from '../catalog';
import { TEMPLATES } from '../domain';
import { initialState } from '../store';
import { endRestActivity, startRestActivity, syncNextWorkout } from './index';
import { EMPTY_NEXT, nextWorkoutProps, restProps } from './summary';

const withProgram = () => {
  const s = initialState();
  s.program = JSON.parse(JSON.stringify(TEMPLATES.base));
  for (const id of ['BARBELL_SQUAT', 'DEADLIFT', 'BENCH_PRESS', 'MILITARY_PRESS']) {
    s.lifts[id] = { weightKg: 62.5, startKg: 20, fails: 0 };
  }
  return s;
};

describe('widget props', () => {
  test('no program → prompt to set up', () => {
    expect(nextWorkoutProps(initialState())).toEqual(EMPTY_NEXT);
  });

  test('next workout lists lifts with weights', () => {
    const s = withProgram();
    const p = nextWorkoutProps(s);
    expect(p.ready).toBe(true);
    expect(p.subtitle).toBe('Week 1');
    expect(p.lines.length).toBeGreaterThan(0);
    expect(p.lines.some((l) => /kg$/.test(l))).toBe(true);
    expect(p.inProgress).toBe(false);
    s.draft = { n: 0, dayName: p.title, startedAt: '', results: {}, order: [] };
    expect(nextWorkoutProps(s).inProgress).toBe(true);
    expect(Object.keys(builtInExercises()).length).toBeGreaterThan(0);
  });

  test('props are JSON-serialisable (they cross into the extension as JSON)', () => {
    const p = nextWorkoutProps(withProgram());
    expect(JSON.parse(JSON.stringify(p))).toEqual(p);
  });

  test('rest props carry absolute times', () => {
    expect(restProps('Squat', 90, 1000)).toEqual({ label: 'Squat', startsAt: 1000, endsAt: 91000 });
    expect(restProps('x', -5, 1000).endsAt).toBe(1000);
  });
});

describe('without the native module', () => {
  test('sync and rest activity are harmless no-ops', () => {
    expect(() => syncNextWorkout(withProgram())).not.toThrow();
    expect(() => startRestActivity('Squat', 90)).not.toThrow();
    expect(() => endRestActivity()).not.toThrow();
  });
});
