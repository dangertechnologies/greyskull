import { builtInExercises } from '../catalog';
import { getPlan } from '../config/plans';
import {
  type Answers,
  answersFrom,
  DEFAULT_ANSWERS,
  decodeAnswers,
  encodeAnswers,
  recommend,
  sessionMinutes,
} from './recommend';

const exercises = builtInExercises();
const gym = ['barbell', 'bench', 'pull-up-bar', 'dip-bars', 'dumbbell'] as const;
const rings = ['pull-up-bar', 'rings', 'none'] as const;

const ask = (patch: Partial<Answers>) => recommend({ ...DEFAULT_ANSWERS, ...patch }, exercises);

describe('recommend', () => {
  test.each<[string, Partial<Answers>, string[], string | null]>([
    // goal, days, minutes, equipment, experience → first picks (in order) and the add-on
    [
      'strength, new lifter, barbell gym',
      { goal: 'strength', days: 3, minutes: 45, equipment: [...gym], experience: 'new' },
      ['base', 'phrak', 'stronglifts'],
      null,
    ],
    [
      'strength, two years, four days',
      { goal: 'strength', days: 4, minutes: 60, equipment: [...gym, 'machine'], experience: '2y' },
      ['gzclp'],
      null,
    ],
    [
      'muscle, six months, gym with cables and machines',
      {
        goal: 'muscle',
        days: 3,
        minutes: 60,
        equipment: [...gym, 'cable', 'machine'],
        experience: '6mo',
      },
      ['allpro', 'full-body-hypertrophy', 'lyle-gbr'],
      null,
    ],
    [
      'calisthenics skills with a pull-up bar and rings',
      { goal: 'calisthenics', days: 3, minutes: 45, equipment: [...rings], experience: '6mo' },
      // Fewer missing items first: Six Ladders lacks a bench, box and bands; the Recommended Routine more.
      ['six-ladders', 'recommended-routine'],
      null,
    ],
    [
      'mobility with dumbbells',
      { goal: 'mobility', days: 3, minutes: 30, equipment: ['dumbbell'], experience: 'new' },
      ['shoulder-mobilex'],
      null,
    ],
  ])('%s', (_name, answers, first, addOn) => {
    const result = ask(answers);
    expect(result.picks.slice(0, first.length).map((p) => p.planId)).toEqual(first);
    expect(result.addOn?.planId ?? null).toBe(addOn);
  });

  test('a plan that fits ranks above one that needs more equipment, which says what it needs', () => {
    const result = ask({ goal: 'strength', equipment: ['barbell', 'bench'], experience: '6mo' });
    const ids = result.picks.map((p) => p.planId);
    expect(ids.indexOf('base')).toBeLessThan(ids.indexOf('phrak') === -1 ? 99 : ids.indexOf('phrak'));
    expect(result.picks[0].reason).toMatch(/fits your equipment/);
    const hybrid = ask({ goal: 'calisthenics', equipment: [...rings] }).picks.find(
      (p) => p.planId === 'hybrid',
    );
    expect(hybrid?.reason).toMatch(/needs barbell/);
  });

  test('mobility with bodyweight only still names the mobility plan, with what it needs', () => {
    const [pick] = ask({ goal: 'mobility', equipment: ['none'] }).picks;
    expect(pick.planId).toBe('shoulder-mobilex');
    expect(pick.reason).toMatch(/needs dumbbell, bench/);
  });

  test('Skill Track is never a main pick; it is the add-on beside a strength plan with time to spare', () => {
    const result = ask({
      goal: 'strength',
      minutes: 90,
      experience: '6mo',
      equipment: [...gym, 'rings', 'parallettes', 'bands'],
    });
    expect(result.picks.map((p) => p.planId)).not.toContain('skill-track');
    expect(result.addOn?.planId).toBe('skill-track');
    expect(result.addOn?.reason).toMatch(/beside/);
  });

  test('calisthenics skills get the Skill Track add-on when the equipment covers it', () => {
    const equipment = ['pull-up-bar', 'rings', 'parallettes', 'dip-bars', 'bands', 'none'] as const;
    const result = ask({ goal: 'calisthenics', equipment: [...equipment], experience: '6mo' });
    expect(result.addOn?.planId).toBe('skill-track');
  });

  test('a new lifter gets no add-on', () => {
    expect(ask({ goal: 'strength', minutes: 90, experience: 'new', equipment: [] }).addOn).toBeUndefined();
  });

  test('equipment not set: nothing is ruled out and no reason claims a fit', () => {
    const result = ask({ goal: 'strength', equipment: [] });
    expect(result.picks.length).toBe(3);
    expect(result.picks.every((p) => !/fits/i.test(p.reason))).toBe(true);
  });

  test('every reason is one line naming the days a week', () => {
    for (const goal of ['strength', 'muscle', 'calisthenics', 'general', 'mobility'] as const) {
      for (const p of ask({ goal, equipment: [] }).picks) {
        expect(p.reason).not.toMatch(/\n/);
        expect(p.reason).toMatch(/days? a week/);
      }
    }
  });

  test('a plan with a different number of days says that it can be changed', () => {
    const pick = ask({ goal: 'strength', days: 5, equipment: [] }).picks[0];
    expect(pick.reason).toMatch(/you can change/);
  });

  test('general fitness ranks plans from more than one category', () => {
    const categories = new Set(
      ask({ goal: 'general', equipment: [] }).picks.map((p) => getPlan(p.planId)?.category),
    );
    expect(categories.size).toBeGreaterThan(1);
  });

  test('session length estimate: longer plans take longer', () => {
    const gslp = sessionMinutes(getPlan('base')!.program);
    const rr = sessionMinutes(getPlan('recommended-routine')!.program);
    expect(gslp).toBeLessThan(rr);
    expect(gslp % 5).toBe(0);
  });
});

describe('answers in a route', () => {
  test('round trip', () => {
    const answers: Answers = { ...DEFAULT_ANSWERS, goal: 'mobility', equipment: ['rings'], days: 5 };
    expect(decodeAnswers(encodeAnswers(answers))).toEqual(answers);
  });

  test.each([undefined, '', 'nonsense', '{"goal":"fly","days":12,"minutes":7,"equipment":["laser"]}'])(
    'bad input %p falls back field by field to the defaults',
    (raw) => {
      const decoded = decodeAnswers(raw);
      expect(decoded.goal).toBe(DEFAULT_ANSWERS.goal);
      expect(decoded.days).toBe(DEFAULT_ANSWERS.days);
      expect(decoded.minutes).toBe(DEFAULT_ANSWERS.minutes);
      expect(decoded.equipment).toEqual([]);
    },
  );
});

describe('fix round: untrusted equipment in the route', () => {
  test('prototype names and unknown values are ignored', () => {
    const raw = JSON.stringify({
      equipment: ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'laser', 'rings', 5],
    });
    expect(decodeAnswers(raw).equipment).toEqual(['rings']);
  });

  test('answersFrom: no parameter takes the saved equipment', () => {
    expect(answersFrom(undefined, ['barbell'])).toEqual({ ...DEFAULT_ANSWERS, equipment: ['barbell'] });
    expect(
      answersFrom(encodeAnswers({ ...DEFAULT_ANSWERS, equipment: ['rings'] }), ['barbell']).equipment,
    ).toEqual(['rings']);
  });
});
