import { builtInExercises } from '../catalog';
import type { Equipment, Exercise } from '../domain';
import { getLadder, LADDERS } from '../domain/ladders';
import { canDoWith } from '../exerciseFilter';
import {
  allowedFor,
  buildPrompt,
  buildSchema,
  checkGenerated,
  cleanText,
  MAX_EXERCISES,
  MAX_TEXT,
  PROMPT_BUDGET,
  SCHEMES,
  toProgram,
} from './prompt';
import { type Answers, DEFAULT_ANSWERS, GOALS } from './recommend';

const exercises = builtInExercises();

type ProgramJson = {
  template: string;
  days: { name: string; groups?: unknown[]; slots: { group?: string }[] }[];
};
type SlotNode = {
  required: string[];
  properties: Record<'exercise' | 'scheme' | 'progression', { enum: string[] }>;
};
type SchemaNode = { properties: { days: { items: { properties: { slots: { items: SlotNode } } } } } };
const bodyweight: Equipment[] = [
  'pull-up-bar',
  'rings',
  'parallettes',
  'dip-bars',
  'bands',
  'box',
  'bench',
  'none',
];
const answers: Answers = { ...DEFAULT_ANSWERS, goal: 'calisthenics', equipment: bodyweight };

describe('cleanText', () => {
  test('strips control characters, folds whitespace and quotes, and caps the length', () => {
    expect(cleanText('a\u0000b\u0007\n\n c\t"d"\\e\u202e', 100)).toBe("ab c 'd'e");
    expect(cleanText('x'.repeat(600), MAX_TEXT)).toHaveLength(MAX_TEXT);
    expect(cleanText(42 as unknown as string, 10)).toBe('');
  });
});

describe('allowedFor', () => {
  test.each(GOALS)(
    '%s: at most 80 exercises, all of them in the catalog and doable with the equipment',
    (goal) => {
      for (const equipment of [[], ['none'], bodyweight, ['barbell', 'bench', 'dumbbell']] as Equipment[][]) {
        const allowed = allowedFor({ ...answers, goal, equipment }, exercises);
        expect(allowed.exercises.length).toBeGreaterThan(0);
        expect(allowed.exercises.length).toBeLessThanOrEqual(MAX_EXERCISES);
        expect(new Set(allowed.exercises).size).toBe(allowed.exercises.length);
        for (const id of allowed.exercises) expect(canDoWith(exercises[id], equipment)).toBe(true);
        for (const id of allowed.ladders) {
          const ladder = getLadder(id);
          expect(ladder).toBeDefined();
          for (const step of ladder?.steps ?? [])
            expect(canDoWith(exercises[step.exercise], equipment)).toBe(true);
        }
      }
    },
  );

  test('equipment not set: every ladder is offered', () => {
    expect(allowedFor({ ...answers, equipment: [] }, exercises).ladders).toEqual(LADDERS.map((l) => l.id));
  });

  test('a step of an offered ladder is not offered again as a plain exercise', () => {
    const allowed = allowedFor({ ...answers, equipment: [] }, exercises);
    const steps = new Set(LADDERS.flatMap((l) => l.steps.map((s) => s.exercise)));
    expect(allowed.exercises.filter((id) => steps.has(id))).toEqual([]);
  });

  test('calisthenics gets bodyweight exercises; strength with a barbell starts with the barbell lifts', () => {
    const cal = allowedFor(answers, exercises);
    expect(cal.exercises.every((id) => exercises[id].kind === 'bodyweight')).toBe(true);
    const strength = allowedFor({ ...answers, goal: 'strength', equipment: ['barbell', 'bench'] }, exercises);
    expect(strength.exercises.slice(0, 10)).toEqual(expect.arrayContaining(['BARBELL_SQUAT', 'BENCH_PRESS']));
  });

  test('a new lifter gets no expert exercises', () => {
    const allowed = allowedFor({ ...answers, goal: 'general', equipment: [] }, exercises);
    expect(allowed.exercises.some((id) => exercises[id].level === 'expert')).toBe(false);
  });

  test('archived exercises are never offered', () => {
    const archived: Record<string, Exercise> = {
      ...exercises,
      BARBELL_SQUAT: { ...exercises.BARBELL_SQUAT, archived: true },
    };
    expect(allowedFor({ ...answers, goal: 'strength', equipment: [] }, archived).exercises).not.toContain(
      'BARBELL_SQUAT',
    );
  });
});

describe('buildPrompt', () => {
  test('carries the answers, the cleaned request and the allowed ids', () => {
    const allowed = allowedFor(answers, exercises);
    const prompt = buildPrompt(answers, 'Muscle-up "this year"\u0000\nplease', allowed);
    expect(prompt).toContain('Calisthenics skills');
    expect(prompt).toContain('3 days a week');
    expect(prompt).toContain('45 minutes');
    expect(prompt).toContain('Pull-up bar');
    expect(prompt).toContain('"Muscle-up \'this year\' please"');
    expect(prompt).not.toContain('\u0000');
    for (const id of [...allowed.exercises, ...allowed.ladders]) expect(prompt).toContain(id);
  });

  test('a retry lists the errors to fix', () => {
    const allowed = allowedFor(answers, exercises);
    const prompt = buildPrompt(answers, 'x', allowed, ['A: unknown scheme 3x.', 'B: Push-up appears twice.']);
    expect(prompt).toMatch(/fix/i);
    expect(prompt).toContain('B: Push-up appears twice.');
  });

  test('stays under the character budget in the worst case: longest text, every goal, no equipment, many errors', () => {
    const errors = Array.from({ length: 30 }, () => 'e'.repeat(400));
    for (const goal of GOALS)
      for (const experience of ['new', '2y'] as const) {
        const worst = { ...answers, goal, experience, equipment: [] };
        const allowed = allowedFor(worst, exercises);
        const prompt = buildPrompt(worst, '"'.repeat(5000), allowed, errors);
        expect(prompt.length).toBeLessThanOrEqual(PROMPT_BUDGET);
      }
  });
});

describe('buildSchema', () => {
  const count = (node: unknown): number => {
    if (!node || typeof node !== 'object') return 0;
    const n = node as { properties?: Record<string, unknown>; items?: unknown };
    return (
      1 +
      Object.values(n.properties ?? {}).reduce<number>((s, p) => s + count(p), 0) +
      (n.items ? count(n.items) : 0)
    );
  };

  test('restricts exercises to the allowed ids and ladders, schemes to the list, and stays small', () => {
    const allowed = allowedFor(answers, exercises);
    const schema = buildSchema(allowed);
    const slot = (schema as unknown as SchemaNode).properties.days.items.properties.slots.items;
    expect(slot.properties.exercise.enum).toEqual([...allowed.exercises, ...allowed.ladders]);
    expect(slot.properties.scheme.enum).toEqual(SCHEMES);
    expect(slot.properties.progression.enum).toEqual(['linear', 'double', 'amrap']);
    expect(slot.required).not.toContain('superset');
    expect(count(schema)).toBeLessThan(1024);
    expect(schema.type).toBe('object');
  });
});

/** A model answer in the shape of the schema. */
const day = (name: string, slots: Record<string, unknown>[]) => ({ name, slots });
const generated = (days: unknown[], extra: Record<string, unknown> = {}) => ({
  name: 'Rings and Squats',
  sessionsPerWeek: 3,
  days,
  ...extra,
});

describe('toProgram (model answer to program)', () => {
  test('a ladder id becomes a ladder slot that starts at its first step with ladder progression', () => {
    const program = toProgram(
      generated([day('Pull', [{ exercise: 'rr_pullup', scheme: '3x5-8', progression: 'amrap' }])]),
    ) as ProgramJson;
    expect(program.days[0].slots[0]).toEqual({
      exercise: getLadder('rr_pullup')?.steps[0].exercise,
      scheme: '3x5-8',
      ladder: 'rr_pullup',
      progression: 'ladder',
    });
    expect(program.template).toBe('custom');
  });

  test('superset letters become superset groups next to each other', () => {
    const program = toProgram(
      generated([
        day('A', [
          { exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double', superset: 'a' },
          { exercise: 'rr_squat', scheme: '3x5-8', progression: 'double', superset: 'A' },
          { exercise: 'rr_hinge', scheme: '3x5-8', progression: 'double', superset: '' },
        ]),
      ]),
    ) as ProgramJson;
    expect(program.days[0].groups).toEqual([{ id: 'superset_A', kind: 'superset', restS: 90 }]);
    expect(program.days[0].slots.map((s: { group?: string }) => s.group)).toEqual([
      'superset_A',
      'superset_A',
      undefined,
    ]);
  });

  test('a day without a name gets one; junk never throws', () => {
    expect((toProgram(generated([day('', [])])) as ProgramJson).days[0].name).toBe('Day 1');
    for (const junk of [null, 'text', 42, [], { days: 'x' }, { days: [null, 3] }])
      expect(() => toProgram(junk)).not.toThrow();
  });
});

describe('checkGenerated', () => {
  const allowed = allowedFor(answers, exercises);
  const ctx = { answers, allowed, exercises };

  const good = generated([
    day('Pull', [
      { exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double', superset: 'A' },
      { exercise: 'rr_squat', scheme: '3x5-8', progression: 'double', superset: 'A' },
    ]),
    day('Push', [
      { exercise: 'rr_dip', scheme: '3x5-8', progression: 'double' },
      { exercise: 'rr_pushup', scheme: '3x5-8', progression: 'double' },
    ]),
  ]);

  test('a valid answer passes with the name and the program', () => {
    const result = checkGenerated(good, ctx);
    expect(result).toMatchObject({ ok: true, name: 'Rings and Squats' });
    if (result.ok) expect(result.program.days).toHaveLength(2);
  });

  test.each<[string, unknown, RegExp]>([
    ['not a program', 'hello', /Invalid training days per week/],
    ['no days', generated([]), /1 to 14 days/],
    ['too many days a week', generated(good.days, { sessionsPerWeek: 9 }), /between 1 and 7/],
    [
      'unknown exercise',
      generated([day('A', [{ exercise: 'NOPE', scheme: '3x5', progression: 'linear' }])]),
      /NOPE/,
    ],
    [
      'an exercise not on the list',
      generated([day('A', [{ exercise: 'BENCH_PRESS', scheme: '3x5', progression: 'linear' }])]),
      /not on the list/,
    ],
    [
      'a timed scheme under amrap',
      generated([
        day('A', [
          { exercise: 'rr_hinge', scheme: '3x5-8', progression: 'double' },
          {
            exercise: allowed.exercises.find((id) => exercises[id].timed) ?? 'CAL_PLANK',
            scheme: '3x30s',
            progression: 'amrap',
          },
        ]),
      ]),
      /timed scheme 3x30s cannot use amrap/,
    ],
    [
      'a bodyweight exercise without a rep range',
      generated([
        day('A', [
          {
            exercise: allowed.exercises.find((id) => !exercises[id].timed) as string,
            scheme: '3x8',
            progression: 'linear',
          },
        ]),
      ]),
      /bodyweight.*rep range/,
    ],
    [
      'a superset of one exercise',
      generated([
        day('A', [{ exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double', superset: 'A' }]),
      ]),
      /superset/i,
    ],
    [
      'the same ladder twice in a day',
      generated([
        day('A', [
          { exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double' },
          { exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double' },
        ]),
      ]),
      /twice|shares/,
    ],
  ])('%s is reported', (_name, raw, message) => {
    const result = checkGenerated(raw, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(message);
  });

  test('an exercise that needs equipment the user does not have is reported', () => {
    const own: Answers = { ...answers, equipment: ['none'] };
    const wide = allowedFor({ ...answers, equipment: [] }, exercises);
    const needy = wide.exercises.find((id) => !canDoWith(exercises[id], ['none'])) as string;
    const raw = generated([day('A', [{ exercise: needy, scheme: '3x8-12', progression: 'double' }])]);
    const result = checkGenerated(raw, { answers: own, allowed: wide, exercises });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join('\n')).toMatch(/equipment you do not have/);
  });

  test('a name that is empty or junk falls back to a plain one', () => {
    const result = checkGenerated({ ...good, name: '\u0000  ' }, ctx);
    expect(result.ok && result.name).toBe('Generated program');
  });
});
