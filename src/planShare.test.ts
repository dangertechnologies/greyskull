import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { builtInExercises } from './catalog';
import type { CustomPlan, Exercise, Program } from './domain';
import { DEFAULT_RULES, validateProgram } from './domain';
import { copyPlan, exportPlan, importPlan, MAX_IMPORT_CHARS, newPlanId, sharePlan } from './planShare';

const builtIns = builtInExercises();

const front: Exercise = {
  id: 'custom_front_squat',
  name: 'Front squat',
  shortName: 'Front',
  kind: 'barbell',
  increment: { kg: 2.5, lb: 5 },
  custom: true,
  equipment: ['barbell'],
  muscles: ['quadriceps'],
  goodForm: ['Elbows up'],
};

const program = (patch: Partial<Program> = {}): Program => ({
  template: 'custom',
  sessionsPerWeek: 3,
  rules: { ...DEFAULT_RULES, progression: 'linear' },
  days: [
    {
      name: 'A',
      slots: [
        { exercise: 'custom_front_squat', scheme: '3x5', lift: 'custom_front_squat@T1' },
        { exercise: 'BENCH_PRESS', scheme: '3x5' },
        { exercise: 'CAL_PULLUP', scheme: '3x5-8', ladder: undefined },
      ].map((s) => JSON.parse(JSON.stringify(s))),
    },
  ],
  ...patch,
});

const plan = (p: Program = program()): CustomPlan => ({
  id: 'plan_a',
  name: 'My plan',
  summary: 'Three lifts',
  program: p,
});
const have = (extra: Record<string, Exercise> = {}) => ({
  exercises: { ...builtIns, ...extra },
  customPlans: [] as CustomPlan[],
});

describe('exportPlan', () => {
  test('writes the format, the plan and only the custom exercises it uses', () => {
    const all = { ...builtIns, custom_front_squat: front, custom_unused: { ...front, id: 'custom_unused' } };
    const out = JSON.parse(exportPlan(plan(), all));
    expect(out.format).toBe('greyskull-plan');
    expect(out.version).toBe(1);
    expect(out.plan.name).toBe('My plan');
    expect(out.exercises.map((e: Exercise) => e.id)).toEqual(['custom_front_squat']);
  });

  test('an export imports back unchanged on a clean device', () => {
    const text = exportPlan(plan(), { ...builtIns, custom_front_squat: front });
    const r = importPlan(text, have());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercises).toEqual([front]);
    expect(r.plan.program).toEqual(plan().program);
    expect(r.plan.name).toBe('My plan');
    expect(r.plan.summary).toBe('Three lifts');
    expect(r.plan.id).not.toBe('plan_a');
    expect(r.renamed).toEqual([]);
  });
});

describe('importPlan', () => {
  const text = (extra: Record<string, unknown> = {}, exercises: unknown[] = [front]) =>
    JSON.stringify({ format: 'greyskull-plan', version: 1, plan: plan(), exercises, ...extra });

  test('plain mistakes get a plain message', () => {
    const msg = (raw: string) => {
      const r = importPlan(raw, have());
      return r.ok ? '' : r.error;
    };
    expect(msg('')).toMatch(/empty|not valid/i);
    expect(msg('{oops')).toMatch(/not valid JSON/);
    expect(msg('[]')).toMatch(/not a Greyskull program/);
    expect(msg(JSON.stringify({ format: 'something', version: 1 }))).toMatch(/not a Greyskull program/);
    expect(msg(text({ version: 2 }))).toMatch(/newer version/);
    expect(msg(text({ plan: null }))).toMatch(/plan/i);
    expect(msg(text({ plan: { id: 'x', name: '', program: program() } }))).toMatch(/name/i);
    expect(msg(text({ plan: { ...plan(), program: { days: [] } } }))).toMatch(/program/i);
    expect(msg(text({ exercises: 'no' }))).toMatch(/exercises/i);
    expect(msg(text({}, [{ id: 'custom_x' }]))).toMatch(/exercise/i);
  });

  test('the size is capped before anything is parsed', () => {
    const r = importPlan(`{"junk":"${'a'.repeat(MAX_IMPORT_CHARS)}"}`, have());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/);
  });

  test('too many exercises are refused', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ ...front, id: `custom_e${i}`, name: `E${i}` }));
    const r = importPlan(text({}, many), have());
    expect(r.ok).toBe(false);
  });

  test('a program that breaks the training rules is refused with the reasons', () => {
    const bad = program();
    bad.days[0].slots[1].scheme = '3x5' as never;
    bad.days[0].slots.push({ exercise: 'NOPE', scheme: '3x5' });
    const r = importPlan(text({ plan: plan(bad) }), have());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unknown exercise NOPE/);
  });

  test('a program that uses a custom exercise the file does not carry is refused', () => {
    const r = importPlan(text({}, []), have());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/custom_front_squat/);
  });

  test('an exercise you already have, unchanged, is reused', () => {
    const r = importPlan(text(), have({ custom_front_squat: front }));
    expect(r.ok && r.exercises).toEqual([]);
    expect(r.ok && r.plan.program.days[0].slots[0].exercise).toBe('custom_front_squat');
  });

  test('a different exercise with the same id gets a new id everywhere it is used', () => {
    const mine: Exercise = { ...front, name: 'My front squat', increment: { kg: 5, lb: 10 } };
    const p = program();
    p.rules.increments = { custom_front_squat: { kg: 1, lb: 2 } };
    const r = importPlan(text({ plan: plan(p) }), have({ custom_front_squat: mine }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercises.map((e) => e.id)).toEqual(['custom_front_squat_2']);
    expect(r.exercises[0]).toMatchObject({ name: 'Front squat', custom: true });
    expect(r.renamed).toEqual([{ from: 'custom_front_squat', to: 'custom_front_squat_2' }]);
    const slot = r.plan.program.days[0].slots[0];
    expect(slot.exercise).toBe('custom_front_squat_2');
    expect(slot.lift).toBe('custom_front_squat_2@T1');
    expect(r.plan.program.rules.increments).toEqual({ custom_front_squat_2: { kg: 1, lb: 2 } });
    expect(
      validateProgram(r.plan.program, {
        ...builtIns,
        custom_front_squat: mine,
        custom_front_squat_2: r.exercises[0],
      }),
    ).toEqual([]);
  });

  test('an exercise that borrows a built-in id is renamed rather than replacing the built-in', () => {
    const hijack = { ...front, id: 'BENCH_PRESS', name: 'Totally bench' };
    const p = program();
    p.days[0].slots[0] = { exercise: 'BENCH_PRESS', scheme: '3x5' };
    p.days[0].slots.splice(1, 1);
    const r = importPlan(text({ plan: plan(p) }, [hijack]), have());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercises[0].id).toBe('custom_totally_bench');
    expect(r.plan.program.days[0].slots[0].exercise).toBe('custom_totally_bench');
  });

  test('ids that cannot be a custom id are renamed', () => {
    const odd = { ...front, id: 'custom_Front@T1', name: 'Odd one' };
    const p = program();
    p.days[0].slots[0] = { exercise: 'custom_Front@T1', scheme: '3x5' };
    const r = importPlan(text({ plan: plan(p) }, [odd]), have());
    expect(r.ok && r.exercises[0].id).toBe('custom_odd_one');
  });

  test('only known exercise fields are kept, and links must be web addresses', () => {
    const dirty = {
      ...front,
      secret: 'x'.repeat(1000),
      url: 'javascript:alert(1)',
      video: 'https://example.com/v',
      archived: true,
      kind: 'barbell',
    };
    const r = importPlan(text({}, [dirty]), have());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [e] = r.exercises;
    expect(e).not.toHaveProperty('secret');
    expect(e).not.toHaveProperty('archived');
    expect(e.url).toBeUndefined();
    expect(e.video).toBe('https://example.com/v');
    expect(e.equipment).toEqual(['barbell']);
  });

  test('unknown equipment, muscle, pattern and level values are refused', () => {
    for (const bad of [
      { equipment: ['barbell', 'jetpack'] },
      { muscles: ['quads'] },
      { secondary: [3] },
      { pattern: 'dance' },
      { level: 'god' },
    ])
      expect(importPlan(text({}, [{ ...front, ...bad }]), have()).ok).toBe(false);
  });

  test('a weight step or a bar that would give a NaN or an unusable weight is refused', () => {
    for (const bad of [
      { step: { kg: 0, lb: 0 } },
      { step: { kg: 0.25, lb: 0.5 } },
      { step: { kg: 1, lb: 0 } },
      { step: { kg: 101, lb: 2 } },
      { barKg: { kg: 0, lb: 45 } },
      { barKg: { kg: 20, lb: 0 } },
      { barKg: { kg: 51, lb: 45 } },
      { barKg: { kg: 20, lb: 111 } },
      { increment: { kg: -1, lb: 2 } },
      { increment: { kg: 2, lb: 101 } },
    ]) {
      const r = importPlan(text({}, [{ ...front, ...bad }]), have());
      expect(r.ok).toBe(false);
    }
    for (const good of [
      { step: { kg: 0.5, lb: 1 } },
      { barKg: { kg: 10, lb: 25 } },
      { increment: { kg: 0, lb: 0 } },
    ])
      expect(importPlan(text({}, [{ ...front, ...good }]), have()).ok).toBe(true);
  });

  test('only the exercises the program uses are added', () => {
    const extra = ['custom_unused_a', 'custom_unused_b'].map((id) => ({ ...front, id, name: id }));
    const r = importPlan(text({}, [front, ...extra]), have());
    expect(r.ok && r.exercises.map((e) => e.id)).toEqual(['custom_front_squat']);
    // An unused exercise that is broken does not spoil the file either.
    expect(importPlan(text({}, [front, { id: 'custom_junk', kind: 'x' }]), have()).ok).toBe(true);
  });

  test('a file that lists an exercise id twice is refused', () => {
    const r = importPlan(text({}, [front, { ...front, name: 'Another' }]), have());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/custom_front_squat.*twice/);
  });

  test('an archived exercise with the same content is not reused: a visible copy is added', () => {
    const archived = { ...front, archived: true };
    const r = importPlan(text(), have({ custom_front_squat: archived }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.exercises.map((e) => e.id)).toEqual(['custom_front_squat_2']);
    expect(r.exercises[0].archived).toBeUndefined();
    expect(r.plan.program.days[0].slots[0].exercise).toBe('custom_front_squat_2');
  });

  test('the version must be a positive whole number', () => {
    for (const version of [0, -3, 1.5, '1', null])
      expect(importPlan(text({ version }), have()).ok).toBe(false);
  });

  describe('names that exist on every object are not exercises, patterns or ladders', () => {
    const hostile = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
    const refused = (raw: string) => {
      const r = importPlan(raw, have());
      expect(r.ok).toBe(false);
      return r.ok ? '' : r.error;
    };
    const slotted = (patch: Record<string, unknown>) => {
      const p = program();
      p.days[0].slots[1] = { exercise: 'BENCH_PRESS', scheme: '3x5', ...patch } as never;
      return plan(p);
    };
    test.each(hostile)('%s as a slot exercise', (id) => {
      expect(refused(text({ plan: slotted({ exercise: id }) }))).toMatch(/unknown exercise/);
    });
    test.each(hostile)('%s as an alternating pair member', (id) => {
      expect(refused(text({ plan: slotted({ exercise: ['BENCH_PRESS', id] }) }))).toMatch(/unknown exercise/);
    });
    test.each(hostile)('%s as a ladder id', (id) => {
      expect(refused(text({ plan: slotted({ ladder: id }) }))).toMatch(/unknown ladder/);
    });
    test.each(hostile)('%s as a lift key', (id) => {
      expect(refused(text({ plan: slotted({ lift: id }) }))).toMatch(/lift/);
    });
    test.each(hostile)('%s as a pattern', (id) => {
      expect(refused(text({}, [{ ...front, pattern: id }]))).toMatch(/pattern/);
    });
    test.each(hostile)('%s as the id of a carried exercise gets a custom id, never the name itself', (id) => {
      const p = program();
      p.days[0].slots[0] = { exercise: id, scheme: '3x5' };
      const r = importPlan(text({ plan: plan(p) }, [{ ...front, id }]), have());
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.exercises[0].id).toBe('custom_front_squat');
      expect(r.plan.program.days[0].slots[0].exercise).toBe('custom_front_squat');
    });
    test('a plan that names no exercise it carries or the app has is refused even with an empty list', () => {
      expect(refused(text({ plan: slotted({ exercise: 'constructor' }) }, []))).toMatch(/unknown exercise/);
    });
  });

  test('a bad exercise value is refused, not guessed', () => {
    for (const bad of [
      { kind: 'jetpack' },
      { increment: { kg: -1, lb: 2 } },
      { increment: { kg: 1e9, lb: 2 } },
      { name: '' },
      { name: 'x'.repeat(101) },
      { goodForm: 'no' },
    ]) {
      const r = importPlan(text({}, [{ ...front, ...bad }]), have());
      expect(r.ok).toBe(false);
    }
  });

  test('the template of an imported plan never poses as a built-in plan', () => {
    const r = importPlan(text({ plan: plan(program({ template: 'base' })) }), have());
    expect(r.ok && r.plan.program.template).toBe('custom');
  });

  test('the name stays unique among saved plans', () => {
    const existing = have();
    existing.customPlans = [{ ...plan(), id: 'plan_old' }];
    const r = importPlan(text(), existing);
    expect(r.ok && r.plan.name).toBe('My plan 2');
  });

  test('every built-in plan survives an export and import', () => {
    const { PLANS } = require('./config/plans') as typeof import('./config/plans');
    for (const p of PLANS) {
      const r = importPlan(exportPlan({ id: p.id, name: p.name, program: p.program }, builtIns), have());
      expect(r).toMatchObject({ ok: true });
    }
  });
});

test('plan ids are fresh', () => {
  const a = newPlanId([]);
  expect(a).toMatch(/^plan_[a-z0-9]+$/);
  expect(newPlanId([a])).not.toBe(a);
});

describe('sharing', () => {
  const fs = jest.requireMock('expo-file-system') as {
    Paths: { cache?: { uri: string } };
    __files: Map<string, string>;
  };
  beforeEach(() => {
    fs.Paths.cache = { uri: 'file:///cache' };
    jest.clearAllMocks();
  });
  const all = { ...builtIns, custom_front_squat: front };

  test('the share sheet gets a .json file with the exported text', async () => {
    expect(await sharePlan(plan(), all)).toBe(true);
    const [uri, options] = (Sharing.shareAsync as jest.Mock).mock.calls[0];
    expect(uri).toBe('file:///cache/greyskull-my-plan.json');
    expect(fs.__files.get(uri)).toBe(exportPlan(plan(), all));
    expect(options).toMatchObject({ mimeType: 'application/json' });
  });

  test('nothing is written when sharing is not available', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    expect(await sharePlan(plan(), all)).toBe(false);
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(fs.__files.size).toBe(0);
  });

  test('copy puts the same text on the clipboard', async () => {
    await copyPlan(plan(), all);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(exportPlan(plan(), all));
  });
});
