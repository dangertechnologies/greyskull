import { getPlan } from './config/plans';
import { initialState, useStore } from './store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const get = () => useStore.getState();

function play(reps: (target: number | null) => number) {
  const draft = get().startSession(get().nextSession);
  for (const id of draft.order)
    draft.results[id].sets.forEach((s, i) => {
      get().logSet(id, i, reps(s.target));
    });
  return { draft, outcomes: get().finishSession() };
}

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

test('StrongLifts: 5x5 sessions, deadlift adds 5 kg, squat every session', () => {
  get().setProgram(getPlan('stronglifts')!.program);
  get().setLift('DEADLIFT', { weightKg: 60 });
  const first = play((t) => t ?? 5);
  expect(first.draft.results.BARBELL_SQUAT.sets).toHaveLength(5);
  expect(first.draft.results.BARBELL_SQUAT.sets.every((s) => s.target === 5)).toBe(true);
  play((t) => t ?? 5); // B: squat, press, deadlift
  expect(get().lifts.BARBELL_SQUAT.weightKg).toBe(25);
  expect(get().lifts.DEADLIFT.weightKg).toBe(65);
  expect(get().lifts.MILITARY_PRESS.weightKg).toBe(22.5);
});

test('AllPro: heavy day adds reps, light/medium days use 80/90 % and change nothing', () => {
  get().setProgram(getPlan('allpro')!.program);
  get().setLift('BARBELL_SQUAT', { weightKg: 100 });

  const heavy = play((t) => t ?? 0);
  expect(heavy.draft.results.BARBELL_SQUAT).toMatchObject({
    weightKg: 100,
    sets: [{ target: 8 }, { target: 8 }],
  });
  expect(heavy.outcomes.BARBELL_SQUAT.change).toBe('reps');
  expect(get().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 100, reps: 9 });

  const light = play((t) => t ?? 0);
  expect(light.draft.intensity).toBe(0.8);
  expect(light.draft.results.BARBELL_SQUAT).toMatchObject({
    weightKg: 80,
    sets: [{ target: 9 }, { target: 9 }],
  });
  expect(light.outcomes.BARBELL_SQUAT.change).toBe('none');

  const medium = play((t) => t ?? 0);
  expect(medium.draft.results.BARBELL_SQUAT.weightKg).toBe(90);
  expect(get().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 100, reps: 9 });

  // Three more heavy weeks reach 12 reps; the week after that adds weight and resets to 8.
  for (let week = 0; week < 4; week++) for (let day = 0; day < 3; day++) play((t) => t ?? 0);
  expect(get().lifts.BARBELL_SQUAT).toMatchObject({ weightKg: 102.5, reps: 8 });
});

test('programs saved before plans existed (no progression field) still use AMRAP rules', () => {
  const legacy = JSON.parse(JSON.stringify(getPlan('base')!.program));
  delete legacy.rules.progression;
  get().setProgram(legacy);
  get().setLift('BARBELL_SQUAT', { weightKg: 100 });
  const { outcomes } = play((t) => (t === null ? 10 : t));
  expect(outcomes.BARBELL_SQUAT.change).toBe('double');
});
