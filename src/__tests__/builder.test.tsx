import { act } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { programId, setProgram } from '../__fixtures__/oneProgram';
import { blankProgram, TEMPLATES } from '../domain';
import { exportPlan, MAX_IMPORT_CHARS } from '../planShare';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const allRoutes = () => ({
  ...routes(),
  'builder/index': require('../../app/builder/index'),
  'builder/[id]': require('../../app/builder/[id]'),
  'builder/import': require('../../app/builder/import'),
});

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  jest.clearAllMocks();
});

const get = () => useStore.getState();
const search = async (text: string) =>
  fireEvent.changeText(await screen.findByLabelText('Search exercises'), text);
const addExercise = async (name: string, day = 0) => {
  fireEvent.press((await screen.findAllByText('Add exercise'))[day]);
  await search(name);
  fireEvent.press(await screen.findByLabelText(name));
};
const progression = (title: string) => screen.findByLabelText(new RegExp(`^Progression of ${title}:`));

test('build a program from nothing, group two exercises, give one a ladder and a timed hold, and save it', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  expect(get().customPlans).toHaveLength(0);
  fireEvent.changeText(await screen.findByLabelText('Program name'), 'Calisthenics three');

  await addExercise('Handstand push-up');
  await addExercise('Plank');
  // A bodyweight exercise starts with a range under Double, a timed one with a range of seconds.
  expect(await screen.findByLabelText(/^Scheme 3x8-12/)).toBeTruthy();
  expect(await screen.findByLabelText(/^Scheme 3x20-40s/)).toBeTruthy();

  // Ladder on the first slot.
  fireEvent.press(await progression('Handstand push-up'));
  fireEvent.press(await screen.findByRole('radio', { name: 'Ladder' }));
  fireEvent.press(await screen.findByLabelText(/^Dip progression, 3 steps/));
  expect(await screen.findByLabelText(/^Ladder: Dip progression/)).toBeTruthy();

  // Superset of the two.
  fireEvent.press(screen.getByText('Group exercises'));
  fireEvent.press(await screen.findByLabelText('Select Dip progression'));
  fireEvent.press(await screen.findByLabelText('Select Plank'));
  fireEvent.press(screen.getByRole('button', { name: 'Superset' }));
  fireEvent.press(await screen.findByText('Make Superset'));
  expect(await screen.findByText('Superset · rest 90 s')).toBeTruthy();
  expect(screen.getByText('A1')).toBeTruthy();
  expect(screen.getByText('A2')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(get().customPlans).toHaveLength(1));
  const [plan] = get().customPlans;
  expect(plan.name).toBe('Calisthenics three');
  const [dip, plank] = plan.program.days[0].slots;
  expect(dip).toMatchObject({
    ladder: 'rr_dip',
    progression: 'ladder',
    exercise: 'CAL_SUPPORT_HOLD',
    group: 'g1',
  });
  expect(plank).toMatchObject({
    exercise: 'CAL_PLANK',
    scheme: '3x20-40s',
    progression: 'double',
    group: 'g1',
  });
  expect(plan.program.days[0].groups).toEqual([{ id: 'g1', kind: 'superset', restS: 90 }]);
  // The saved program starts alongside a running one.
  setProgram(TEMPLATES.base);
  const id = get().addProgram({ ...plan.program, name: plan.name });
  expect(get().programs).toHaveLength(2);
  expect(get().programs.find((p) => p.id === id)?.name).toBe('Calisthenics three');
});

test('the scheme sheet counts in seconds and its holds are kept off AMRAP', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  await addExercise('Barbell Deadlift');
  fireEvent.press(await screen.findByLabelText(/^Scheme 2x5\+/));
  fireEvent.press(await screen.findByRole('radio', { name: 'Seconds' }));
  fireEvent.press(await screen.findByRole('radio', { name: 'Range' }));
  fireEvent.press(screen.getAllByRole('button', { name: 'Save' })[0]);
  expect(await screen.findByLabelText(/^Scheme 2x30-45s/)).toBeTruthy();
  // A hold cannot be AMRAP: the slot moved to Double and says why AMRAP is not offered.
  fireEvent.press(await progression('Barbell Deadlift'));
  fireEvent.press(await screen.findByRole('radio', { name: 'AMRAP' }));
  expect(await screen.findByText(/A hold cannot use AMRAP/)).toBeTruthy();
});

test('a bodyweight exercise explains why only Double and a ladder are offered', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  await addExercise('Dips');
  fireEvent.press(await progression('Dips'));
  fireEvent.press(await screen.findByRole('radio', { name: 'Linear' }));
  expect(await screen.findByText(/Bodyweight exercises only progress with Double/)).toBeTruthy();
  expect(get().customPlans).toHaveLength(0);
});

test('validation errors from the program show under the day and block saving', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  expect(await screen.findByText('Day 1 has no exercises.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  await addExercise('Dips');
  fireEvent.press(screen.getByText('Group exercises'));
  fireEvent.press(await screen.findByLabelText('Select Dips'));
  fireEvent.press(screen.getByRole('button', { name: 'Circuit' }));
  expect(screen.getByRole('button', { name: 'Circuit' }).props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText(/Superset and Circuit need at least two/)).toBeTruthy();
});

test('ungroup frees the exercises again', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  await addExercise('Dips');
  await addExercise('Plank');
  fireEvent.press(screen.getByText('Group exercises'));
  fireEvent.press(await screen.findByLabelText('Select Dips'));
  fireEvent.press(await screen.findByLabelText('Select Plank'));
  fireEvent.press(screen.getByRole('button', { name: 'EMOM' }));
  fireEvent.press(await screen.findByText('Make EMOM'));
  expect(await screen.findByText('EMOM · 10 min')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Ungroup EMOM A'));
  await waitFor(() => expect(screen.queryByText('EMOM · 10 min')).toBeNull());
});

test('Duplicate & edit copies a running program into a new custom one', async () => {
  setProgram(TEMPLATES.base);
  await renderRouter(allRoutes(), { initialUrl: `/program/${programId()}` });
  fireEvent.press(await screen.findByText('Duplicate & edit'));
  expect((await screen.findByLabelText('Program name')).props.value).toBe('Test program copy');
  expect(await screen.findByLabelText('Name of day 3')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(get().customPlans).toHaveLength(1));
  expect(get().customPlans[0].program.template).toBe('custom');
  expect(get().programs).toHaveLength(1);
});

test('a built-in plan is copied from the builder home', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder' });
  fireEvent.press(await screen.findByText('Greyskull LP'));
  expect((await screen.findByLabelText('Program name')).props.value).toBe('Greyskull LP copy');
});

test('a program id that does not exist is not found', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/nope' });
  expect(await screen.findByText('Program not found')).toBeTruthy();
});

test('a copy of a program that does not exist is not found either', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new?program=nope' });
  expect(await screen.findByText('Program not found')).toBeTruthy();
});

describe('share and import', () => {
  const save = async () => {
    await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
    fireEvent.changeText(await screen.findByLabelText('Program name'), 'Shared one');
    await addExercise('Plank');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(get().customPlans).toHaveLength(1));
  };

  test('copy as text puts the plan on the clipboard and the import screen adds it back', async () => {
    await save();
    const [plan] = get().customPlans;
    fireEvent.press(await screen.findByRole('button', { name: 'Copy as text' }));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const text = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0] as string;
    expect(text).toBe(exportPlan(plan, get().exercises));

    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce(text);
    act(() => router.push('/builder/import'));
    fireEvent.press(await screen.findByText('Paste from clipboard'));
    fireEvent.press(await screen.findByRole('button', { name: 'Import' }));
    await waitFor(() => expect(get().customPlans).toHaveLength(2));
    const copy = get().customPlans[1];
    expect(copy.id).not.toBe(plan.id);
    expect(copy.name).toBe('Shared one 2');
    expect(copy.program).toEqual(plan.program);
  });

  test('a bad import says what is wrong and adds nothing', async () => {
    await renderRouter(allRoutes(), { initialUrl: '/builder/import' });
    expect((await screen.findByRole('button', { name: 'Import' })).props.accessibilityState.disabled).toBe(
      true,
    );
    fireEvent.changeText(await screen.findByLabelText('Shared program'), '{nope');
    fireEvent.press(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Shared program'), JSON.stringify({ hello: 1 }));
    fireEvent.press(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('This is not a Greyskull program.')).toBeTruthy();
    expect(get().customPlans).toHaveLength(0);
  });

  test('importing a plan with a custom exercise adds the exercise, and a clash gets a new id', async () => {
    const mine = {
      id: 'custom_front_squat',
      name: 'Front squat',
      shortName: 'Front',
      kind: 'barbell',
      increment: { kg: 2.5, lb: 5 },
      custom: true,
    } as const;
    const plan = {
      id: 'x',
      name: 'Imported',
      program: {
        template: 'custom',
        sessionsPerWeek: 3,
        rules: { doubleAt: 10, deloadPct: 0.1, failsBeforeDeload: 1, warmups: true },
        days: [{ name: 'A', slots: [{ exercise: 'custom_front_squat', scheme: '2x5+' }] }],
      },
    };
    const text = JSON.stringify({ format: 'greyskull-plan', version: 1, plan, exercises: [mine] });
    get().upsertExercise({ ...mine, name: 'Another front squat' });
    await renderRouter(allRoutes(), { initialUrl: '/builder/import' });
    fireEvent.changeText(await screen.findByLabelText('Shared program'), text);
    fireEvent.press(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(get().customPlans).toHaveLength(1));
    expect(get().exercises.custom_front_squat.name).toBe('Another front squat');
    expect(get().exercises.custom_front_squat_2.name).toBe('Front squat');
    expect(get().customPlans[0].program.days[0].slots[0].exercise).toBe('custom_front_squat_2');
  });

  test('deleting a saved program asks first', async () => {
    await save();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    fireEvent.press(await screen.findByRole('button', { name: 'Delete program' }));
    expect(alert.mock.calls[0][0]).toMatch(/^Delete Shared one/);
    alert.mockRestore();
    expect(get().customPlans).toHaveLength(1);
  });
});

test('an error is shown under the day it belongs to even when two days share a name', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  fireEvent.press(await screen.findByText('Add day'));
  fireEvent.changeText(await screen.findByLabelText('Name of day 2'), 'Day 1');
  // Both days are empty and called "Day 1": each shows its own message.
  await waitFor(() => expect(screen.getAllByText('Day 1 has no exercises.')).toHaveLength(2));
  expect(screen.getByTestId('day-error-0').props.children).toBe('Day 1 has no exercises.');
  expect(screen.getByTestId('day-error-1').props.children).toBe('Day 1 has no exercises.');
});

test('the day name box stops at 100 letters, and Add day stops at 14 days', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  expect((await screen.findByLabelText('Name of day 1')).props.maxLength).toBe(100);
  for (let i = 0; i < 13; i++) fireEvent.press(screen.getByText('Add day'));
  await screen.findByLabelText('Name of day 14');
  expect(screen.getByRole('button', { name: 'Add day' }).props.accessibilityState.disabled).toBe(true);
});

test('error messages are announced when they appear', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  expect((await screen.findByText('Day 1 has no exercises.')).props.accessibilityLiveRegion).toBe('polite');
});

test('saving under a name another saved program has keeps both, with the new one numbered', async () => {
  await renderRouter(allRoutes(), { initialUrl: '/builder/new' });
  fireEvent.changeText(await screen.findByLabelText('Program name'), 'Mine');
  await addExercise('Plank');
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(get().customPlans.map((p) => p.name)).toEqual(['Mine']));
  act(() => router.push('/builder/new'));
  const names = await screen.findAllByLabelText('Program name');
  fireEvent.changeText(names[names.length - 1], ' mine ');
  await addExercise('Plank');
  fireEvent.press(screen.getAllByRole('button', { name: 'Save' }).at(-1) as never);
  await waitFor(() => expect(get().customPlans.map((p) => p.name)).toEqual(['Mine', 'mine 2']));
});

test('renaming a saved program to another saved name is numbered too', async () => {
  get().saveCustomPlan({
    id: 'a',
    name: 'Alpha',
    program: { ...blankProgram(), days: [{ name: 'A', slots: [{ exercise: 'DEADLIFT', scheme: '1x5+' }] }] },
  });
  get().saveCustomPlan({
    id: 'b',
    name: 'Beta',
    program: { ...blankProgram(), days: [{ name: 'A', slots: [{ exercise: 'DEADLIFT', scheme: '1x5+' }] }] },
  });
  await renderRouter(allRoutes(), { initialUrl: '/builder/b' });
  fireEvent.changeText(await screen.findByLabelText('Program name'), 'Alpha');
  fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(get().customPlans.find((p) => p.id === 'b')?.name).toBe('Alpha 2'));
  expect(get().customPlans.find((p) => p.id === 'a')?.name).toBe('Alpha');
  // Saving it again under its own name changes nothing.
  expect((await screen.findByLabelText('Program name')).props.value).toBe('Alpha 2');
});

describe('importing from the clipboard', () => {
  test('text over the size limit is cut before it fills the box, and the cut is announced', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce('x'.repeat(MAX_IMPORT_CHARS + 5000));
    await renderRouter(allRoutes(), { initialUrl: '/builder/import' });
    fireEvent.press(await screen.findByText('Paste from clipboard'));
    expect(await screen.findByText(/longer than the limit/)).toBeTruthy();
    expect((await screen.findByLabelText('Shared program')).props.value).toHaveLength(MAX_IMPORT_CHARS);
  });
});
