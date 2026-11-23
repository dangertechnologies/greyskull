import { generateAsync, getAvailabilityAsync, prepareAsync } from 'expo-ai';
import { builtInExercises } from '../catalog';
import type { Equipment } from '../domain';
import { checkModel, downloadModel, generatePlan, type Request, TIMEOUT_MS } from './model';
import { DEFAULT_ANSWERS } from './recommend';

jest.mock('expo-ai', () => ({
  getAvailabilityAsync: jest.fn(),
  prepareAsync: jest.fn(),
  generateAsync: jest.fn(),
}));

const availability = getAvailabilityAsync as jest.Mock;
const prepare = prepareAsync as jest.Mock;
const generate = generateAsync as jest.Mock;

const fail = (code: string) => Object.assign(new Error(code), { code });

const equipment: Equipment[] = [
  'pull-up-bar',
  'rings',
  'parallettes',
  'dip-bars',
  'bands',
  'box',
  'bench',
  'none',
];
const request = (patch: Partial<Request> = {}): Request => ({
  answers: { ...DEFAULT_ANSWERS, goal: 'calisthenics', equipment },
  text: 'Three days, pull-up bar and rings, first muscle-up this year.',
  exercises: builtInExercises(),
  taken: { ids: [], names: ['Rings and Squats'] },
  ...patch,
});

const good = {
  name: 'Rings and Squats',
  sessionsPerWeek: 3,
  days: [
    {
      name: 'Pull',
      slots: [
        { exercise: 'rr_pullup', scheme: '3x5-8', progression: 'double', superset: 'A' },
        { exercise: 'rr_squat', scheme: '3x5-8', progression: 'double', superset: 'A' },
      ],
    },
    { name: 'Push', slots: [{ exercise: 'rr_dip', scheme: '3x5-8', progression: 'double' }] },
  ],
};
const bad = {
  ...good,
  days: [{ name: 'A', slots: [{ exercise: 'NOPE', scheme: '3x5', progression: 'linear' }] }],
};

beforeEach(() => jest.clearAllMocks());

describe('checkModel', () => {
  test.each<[string, unknown, unknown]>([
    ['available', { status: 'available', capabilities: {} }, { kind: 'ready' }],
    [
      'Apple Intelligence off',
      { status: 'unavailable', reason: 'intelligence-disabled' },
      { kind: 'disabled' },
    ],
    [
      'old OS',
      { status: 'unavailable', reason: 'unsupported-os' },
      { kind: 'unsupported', reason: 'unsupported-os' },
    ],
    [
      'unsupported device',
      { status: 'unavailable', reason: 'unsupported-device' },
      { kind: 'unsupported', reason: 'unsupported-device' },
    ],
    [
      'downloading',
      { status: 'downloading', progress: 0.4 },
      { kind: 'downloading', progress: 0.4, canDownload: false },
    ],
    [
      'downloadable (Android)',
      { status: 'downloadable', progress: null },
      { kind: 'downloading', progress: null, canDownload: true },
    ],
    [
      'not ready yet',
      { status: 'not-ready', progress: null },
      { kind: 'downloading', progress: null, canDownload: false },
    ],
  ])('%s', async (_name, value, expected) => {
    availability.mockResolvedValue(value);
    await expect(checkModel()).resolves.toEqual(expected);
  });

  test('a throw becomes unsupported, never a crash', async () => {
    availability.mockRejectedValue(new Error('native crash'));
    await expect(checkModel()).resolves.toEqual({ kind: 'unsupported', reason: 'error' });
  });

  test('without the native module (Jest, Expo Go) the real package says so instead of throwing', async () => {
    const real = jest.requireActual('expo-ai') as typeof import('expo-ai');
    await expect(real.getAvailabilityAsync()).resolves.toEqual({
      status: 'unavailable',
      reason: 'module-unavailable',
    });
  });
});

test('downloadModel asks to download, survives a throw and reads the status again', async () => {
  prepare.mockRejectedValue(fail('ERR_PREPARATION_FAILED'));
  availability.mockResolvedValue({ status: 'available', capabilities: {} });
  const progress = jest.fn();
  await expect(downloadModel(progress)).resolves.toEqual({ kind: 'ready' });
  expect(prepare).toHaveBeenCalledWith({ allowDownload: true, onProgress: progress });
});

describe('generatePlan', () => {
  test('a valid answer becomes a plan with a unique name, a summary and a new id; nothing is saved', async () => {
    generate.mockResolvedValue({ value: good });
    const result = await generatePlan(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.name).toBe('Rings and Squats 2');
    expect(result.plan.id).toMatch(/^plan_/);
    expect(result.plan.summary).toMatch(/^2 days · about \d+ min · made on this device$/);
    expect(result.plan.program.days[0].groups).toEqual([{ id: 'superset_A', kind: 'superset', restS: 90 }]);
    const [prompt, options] = generate.mock.calls[0];
    expect(prompt).toContain('first muscle-up this year');
    expect(options.schema.type).toBe('object');
    expect(options.timeoutMs).toBeLessThanOrEqual(TIMEOUT_MS);
    expect(options.timeoutMs).toBeGreaterThan(TIMEOUT_MS - 1000);
  });

  test('an invalid answer is retried once with its errors; a valid second answer wins', async () => {
    generate.mockResolvedValueOnce({ value: bad }).mockResolvedValueOnce({ value: good });
    const result = await generatePlan(request());
    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0]).toMatch(/Fix them[\s\S]*NOPE/);
  });

  test('invalid twice: the errors of the second answer, and no third call', async () => {
    generate.mockResolvedValue({ value: bad });
    const result = await generatePlan(request());
    expect(result).toEqual({
      ok: false,
      failure: 'invalid',
      errors: expect.arrayContaining([expect.stringMatching(/NOPE/)]),
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test('an answer the library could not fit to the schema is retried like an invalid one', async () => {
    generate
      .mockRejectedValueOnce(fail('ERR_VALIDATION_RETRIES_EXHAUSTED'))
      .mockResolvedValueOnce({ value: good });
    expect((await generatePlan(request())).ok).toBe(true);
    generate.mockRejectedValue(fail('ERR_RESPONSE_INVALID'));
    await expect(generatePlan(request())).resolves.toEqual({
      ok: false,
      failure: 'invalid',
      errors: ['The answer did not match the program format.'],
    });
  });

  test.each([
    ['ERR_TIMEOUT', 'timeout'],
    ['ERR_MODEL_REFUSAL', 'refused'],
    ['ERR_APP_BACKGROUND', 'background'],
    ['ERR_ABORTED', 'cancelled'],
    ['ERR_MODEL_NOT_READY', 'unavailable'],
    ['ERR_MODEL_UNAVAILABLE', 'unavailable'],
    ['ERR_GENERATION_FAILED', 'error'],
    ['ERR_CONTEXT_WINDOW_EXCEEDED', 'error'],
  ])('%s is reported as %s without a retry', async (code, failure) => {
    generate.mockRejectedValue(fail(code));
    const result = await generatePlan(request());
    expect(result).toMatchObject({ ok: false, failure });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('a throw that is not a model error is an error, never a crash', async () => {
    generate.mockRejectedValue(new TypeError('undefined is not a function'));
    await expect(generatePlan(request())).resolves.toEqual({ ok: false, failure: 'error', errors: [] });
  });

  test('cancelling passes the signal and reports a cancel whatever the library throws', async () => {
    const controller = new AbortController();
    generate.mockImplementation(async () => {
      controller.abort();
      throw new Error('stopped');
    });
    const result = await generatePlan(request({ signal: controller.signal }));
    expect(result).toEqual({ ok: false, failure: 'cancelled', errors: [] });
    expect(generate.mock.calls[0][1].signal).toBe(controller.signal);
  });

  test('the retry gets what is left of the one 30 s deadline', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    generate.mockImplementationOnce(async () => {
      now.mockReturnValue(1_000_000 + 20_000);
      return { value: bad };
    });
    generate.mockResolvedValueOnce({ value: good });
    await generatePlan(request());
    expect(generate.mock.calls[1][1].timeoutMs).toBe(10_000);
    now.mockRestore();
  });
});
