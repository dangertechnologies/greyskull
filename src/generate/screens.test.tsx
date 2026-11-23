import { act } from '@testing-library/react-native';
import { generateAsync, getAvailabilityAsync, prepareAsync } from 'expo-ai';
import { useLocalSearchParams } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Linking, Text } from 'react-native';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';
import { DEFAULT_ANSWERS, encodeAnswers } from './recommend';

jest.mock('expo-ai', () => ({
  getAvailabilityAsync: jest.fn(),
  prepareAsync: jest.fn(),
  generateAsync: jest.fn(),
}));

const availability = getAvailabilityAsync as jest.Mock;
const prepare = prepareAsync as jest.Mock;
const generate = generateAsync as jest.Mock;
const fail = (code: string) => Object.assign(new Error(code), { code });

function BuilderStub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Text>{`Builder for ${id}`}</Text>;
}

const appRoutes = () => ({
  ...routes(),
  'generate/index': require('../../app/generate/index'),
  'generate/results': require('../../app/generate/results'),
  'generate/describe': require('../../app/generate/describe'),
  // The builder screen is built elsewhere; only the route matters here.
  'builder/[id]': { default: BuilderStub },
});

const equipment = [
  'pull-up-bar',
  'rings',
  'parallettes',
  'dip-bars',
  'bands',
  'box',
  'bench',
  'none',
] as const;
const describeUrl = `/generate/describe?a=${encodeURIComponent(
  encodeAnswers({ ...DEFAULT_ANSWERS, goal: 'calisthenics', equipment: [...equipment] }),
)}`;

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

const ready = () => availability.mockResolvedValue({ status: 'available', capabilities: {} });

async function describeWith(text = 'Three days, rings, my first muscle-up.') {
  await renderRouter(appRoutes(), { initialUrl: describeUrl });
  expect(await screen.findByText('Model ready')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('describe-text'), text);
}

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ ...initialState(), hydrated: true });
});

describe('Generate a program: entry and questions', () => {
  test('the add-program picker offers it; first-time setup does not', async () => {
    await renderRouter(appRoutes(), { initialUrl: '/setup/plan' });
    expect(await screen.findByText('Step 2 of 3')).toBeTruthy();
    expect(screen.queryByTestId('setup-generate')).toBeNull();
  });

  test('questions with the equipment prefilled, recommendations, and a pick opens the picker with it chosen', async () => {
    useStore.setState({ equipment: ['barbell', 'bench'] });
    await renderRouter(appRoutes(), { initialUrl: '/setup/plan?add=1' });
    fireEvent.press(await screen.findByTestId('setup-generate'));
    expect(await screen.findByText('Days a week')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Barbell' }).props.accessibilityState).toEqual({
      checked: true,
    });
    expect(screen.getByRole('checkbox', { name: 'Rings' }).props.accessibilityState).toEqual({
      checked: false,
    });
    fireEvent.press(screen.getByRole('radio', { name: 'Strength' }));
    fireEvent.press(screen.getByTestId('generate-recommend'));
    const first = await screen.findByTestId('recommend-base');
    expect(
      screen.getAllByText(/Strength program · 3 days a week · about \d+ min · fits your equipment/).length,
    ).toBe(3);
    fireEvent.press(first);
    expect(
      (await screen.findByRole('radio', { name: /^Greyskull LP/ })).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  test('"Describe it instead" opens the text box with the answers', async () => {
    ready();
    await renderRouter(appRoutes(), { initialUrl: '/generate' });
    fireEvent.press(await screen.findByTestId('generate-describe'));
    expect(await screen.findByText('Model ready')).toBeTruthy();
  });
});

describe('Describe it: the model is not available', () => {
  test.each([
    ['unsupported-os', /needs iOS 26 or later/],
    ['unsupported-device', /does not support Apple Intelligence/],
    ['module-unavailable', /does not include the on-device model/],
    ['model-unavailable', /no on-device model/],
  ])('%s: one-line reason, text box off, questions offered', async (reason, line) => {
    availability.mockResolvedValue({ status: 'unavailable', reason });
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    expect((await screen.findByTestId('describe-reason')).props.children).toMatch(line);
    expect(screen.getByText('Not available right now')).toBeTruthy();
    expect(screen.getByTestId('describe-text').props.editable).toBe(false);
    expect(screen.getByTestId('describe-questions')).toBeTruthy();
    expect(screen.queryByTestId('describe-generate')).toBeNull();
  });

  test('a throw from the availability check is shown as unavailable, never a crash', async () => {
    availability.mockRejectedValue(new Error('native crash'));
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    expect((await screen.findByTestId('describe-reason')).props.children).toMatch(/no on-device model/);
  });

  test('Apple Intelligence off: says where to turn it on and opens system Settings', async () => {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    availability.mockResolvedValue({ status: 'unavailable', reason: 'intelligence-disabled' });
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    expect((await screen.findByTestId('describe-reason')).props.children).toMatch(
      /Apple Intelligence is turned off.*Apple Intelligence and Siri/,
    );
    fireEvent.press(screen.getByText('Open system Settings'));
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });

  test('downloading: progress, and Check again finds it ready', async () => {
    availability.mockResolvedValueOnce({ status: 'downloading', progress: 0.4 });
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    expect((await screen.findByTestId('describe-reason')).props.children).toMatch(
      /still downloading \(40 %\)/,
    );
    expect(screen.queryByText('Download the model')).toBeNull();
    ready();
    fireEvent.press(screen.getByText('Check again'));
    expect(await screen.findByText('Model ready')).toBeTruthy();
  });

  test('downloadable (Android): Download the model asks the system to download it', async () => {
    availability.mockResolvedValue({ status: 'downloadable', progress: null });
    prepare.mockResolvedValue({ status: 'available' });
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    fireEvent.press(await screen.findByText('Download the model'));
    await act(async () => undefined);
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ allowDownload: true }));
  });
});

describe('Describe it: the model is ready', () => {
  beforeEach(ready);

  test('500-character cap with a counter; Generate needs some text', async () => {
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    expect(await screen.findByText('0 / 500')).toBeTruthy();
    expect(screen.getByTestId('describe-generate').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    fireEvent.changeText(screen.getByTestId('describe-text'), 'x'.repeat(600));
    expect(screen.getByTestId('describe-text').props.value).toHaveLength(500);
    expect(screen.getByText('500 / 500')).toBeTruthy();
  });

  test('generating shows Cancel; cancelling stops the request and returns to the text', async () => {
    let signal: AbortSignal | undefined;
    generate.mockImplementation((_prompt: string, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return new Promise(() => undefined);
    });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByText(/Writing your program on this phone/)).toBeTruthy();
    expect(screen.getByTestId('describe-text').props.editable).toBe(false);
    fireEvent.press(screen.getByTestId('describe-cancel'));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByTestId('describe-generate')).toBeTruthy();
    expect(screen.getByTestId('describe-text').props.value).toMatch(/muscle-up/);
  });

  test('success: preview with days and checks; Review in builder saves it and opens the builder, nothing starts', async () => {
    generate.mockResolvedValue({ value: good });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByText('Made on this device')).toBeTruthy();
    expect(screen.getByText('Pull-up progression · Squat progression')).toBeTruthy();
    expect(screen.getByText('Only equipment you own')).toBeTruthy();
    expect(useStore.getState().customPlans).toEqual([]);
    fireEvent.press(screen.getByTestId('describe-review'));
    const [plan] = useStore.getState().customPlans;
    expect(plan.name).toBe('Rings and Squats');
    expect(await screen.findByText(`Builder for ${plan.id}`)).toBeTruthy();
    expect(useStore.getState().programs).toEqual([]);
    expect(useStore.getState().draft).toBeNull();
  });

  test('Discard drops the preview and saves nothing', async () => {
    generate.mockResolvedValue({ value: good });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    fireEvent.press(await screen.findByTestId('describe-discard'));
    expect(await screen.findByTestId('describe-generate')).toBeTruthy();
    expect(useStore.getState().customPlans).toEqual([]);
  });

  test.each([
    ['ERR_TIMEOUT', 'Timed out', /longer than 30 seconds/],
    ['ERR_MODEL_REFUSAL', 'The model declined', /would not answer/],
    ['ERR_APP_BACKGROUND', 'Stopped in the background', /Keep the app open/],
    ['ERR_GENERATION_FAILED', 'Something went wrong', /could not finish/],
  ])('%s: its own message and Try again', async (code, title, body) => {
    generate.mockRejectedValueOnce(fail(code)).mockResolvedValueOnce({ value: good });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Made on this device')).toBeTruthy();
  });

  test('the model stops being available mid-request: Check again', async () => {
    generate.mockRejectedValue(fail('ERR_MODEL_NOT_READY'));
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByText('The model is no longer available')).toBeTruthy();
    fireEvent.press(screen.getByText('Check again'));
    expect(await screen.findByText('Model ready')).toBeTruthy();
  });

  test('invalid after one retry: the errors are listed', async () => {
    generate.mockResolvedValue({ value: bad });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByText('The program did not check out')).toBeTruthy();
    expect(screen.getAllByText(/NOPE/).length).toBeGreaterThan(0);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(useStore.getState().customPlans).toEqual([]);
  });
});

describe('fix round', () => {
  test('VoiceOver hears the reason the model is unavailable', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    availability.mockResolvedValue({ status: 'unavailable', reason: 'intelligence-disabled' });
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    await screen.findByTestId('describe-reason');
    expect(announce).toHaveBeenLastCalledWith(expect.stringMatching(/Apple Intelligence is turned off/));
    announce.mockRestore();
  });

  test('VoiceOver hears generating, the failure with its reason, and the result', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    ready();
    generate.mockRejectedValueOnce(fail('ERR_TIMEOUT')).mockResolvedValueOnce({ value: good });
    await describeWith();
    fireEvent.press(screen.getByTestId('describe-generate'));
    await screen.findByText('Timed out');
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(/Writing your program/));
    expect(announce).toHaveBeenLastCalledWith(expect.stringMatching(/Timed out.*30 seconds/));
    fireEvent.press(screen.getByText('Try again'));
    await screen.findByText('Made on this device');
    expect(announce).toHaveBeenLastCalledWith(expect.stringMatching(/Rings and Squats is ready/));
    announce.mockRestore();
  });

  test('a second Generate aborts the first request', async () => {
    ready();
    const signals: AbortSignal[] = [];
    generate.mockImplementation((_p: string, options: { signal: AbortSignal }) => {
      signals.push(options.signal);
      return new Promise(() => undefined);
    });
    await describeWith();
    // A fast double tap: both presses reach the handler before the button re-renders as Cancel.
    type Node = { props: { onPress?: () => void }; parent: Node | null };
    let node = screen.getByTestId('describe-generate') as unknown as Node | null;
    while (node && !node.props.onPress) node = node.parent;
    const press = node?.props.onPress as () => void;
    await act(async () => {
      press();
      press();
    });
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  test('a slow download does not overwrite a running generation', async () => {
    let finishDownload: (v: unknown) => void = () => undefined;
    availability.mockResolvedValueOnce({ status: 'downloadable', progress: null });
    prepare.mockImplementation(() => new Promise((resolve) => (finishDownload = resolve)));
    generate.mockImplementation(() => new Promise(() => undefined));
    await renderRouter(appRoutes(), { initialUrl: describeUrl });
    fireEvent.press(await screen.findByText('Download the model'));
    ready();
    fireEvent.press(screen.getByText('Check again'));
    await screen.findByText('Model ready');
    fireEvent.changeText(screen.getByTestId('describe-text'), 'Rings.');
    fireEvent.press(screen.getByTestId('describe-generate'));
    expect(await screen.findByTestId('describe-cancel')).toBeTruthy();
    await act(async () => finishDownload({ status: 'available' }));
    await act(async () => undefined);
    expect(screen.getByTestId('describe-cancel')).toBeTruthy();
  });

  test('results opened without answers use the saved equipment', async () => {
    useStore.setState({ equipment: ['barbell', 'bench', 'pull-up-bar', 'dip-bars', 'dumbbell'] });
    await renderRouter(appRoutes(), { initialUrl: '/generate/results' });
    expect((await screen.findAllByText(/fits your equipment/)).length).toBeGreaterThan(0);
  });

  test('prototype names in the equipment of a link are ignored', async () => {
    useStore.setState({ equipment: ['barbell', 'bench'] });
    const hostile = encodeURIComponent(
      JSON.stringify({ goal: 'strength', equipment: ['toString', '__proto__', 'constructor'] }),
    );
    await renderRouter(appRoutes(), { initialUrl: `/generate/results?a=${hostile}` });
    expect(await screen.findByTestId('recommend-base')).toBeTruthy();
    expect(screen.queryAllByText(/fits your equipment/)).toEqual([]);
  });

  test('the questions screen survives stored equipment with prototype names', async () => {
    useStore.setState({ equipment: ['rings', 'toString', 'constructor'] as never });
    await renderRouter(appRoutes(), { initialUrl: '/generate' });
    expect((await screen.findByRole('checkbox', { name: 'Rings' })).props.accessibilityState).toEqual({
      checked: true,
    });
    expect(screen.queryByRole('checkbox', { name: /function|toString|constructor/ })).toBeNull();
  });
});
