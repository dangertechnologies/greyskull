import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

const add = (name: string, template: keyof typeof TEMPLATES): string =>
  useStore.getState().addProgram({ ...TEMPLATES[template], name });

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
});

afterEach(() => jest.restoreAllMocks());

describe('Today', () => {
  test('with no program but past workouts it offers to add one', async () => {
    const id = add('Old', 'base');
    useStore.getState().startSession(id);
    useStore.getState().finishSession();
    useStore.getState().removeProgram(id);
    await renderRouter(routes(), { initialUrl: '/' });
    expect((await screen.findAllByText('No program yet')).length).toBeGreaterThan(0);
    fireEvent.press(screen.getAllByText('Add a program')[0]);
    expect(await screen.findByRole('radio', { name: /^Greyskull LP/ })).toBeTruthy();
  });

  test('a fresh install with nothing at all goes to setup', async () => {
    await renderRouter(routes(), { initialUrl: '/' });
    expect(await screen.findByText('Get started')).toBeTruthy();
  });

  test('one program: a card with the next day, Start and Skip; Skip can be undone', async () => {
    const id = add('GSLP', 'base');
    await renderRouter(routes(), { initialUrl: '/' });
    expect(await screen.findByText('Next: Day 1 · Week 1')).toBeTruthy();
    expect(screen.getAllByText('Strength').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId(`skip-${id}`));
    expect(useStore.getState().programs[0].position).toBe(1);
    expect(await screen.findByText('Next: Day 2 · Week 1')).toBeTruthy();
    expect(screen.getByText('GSLP: workout skipped')).toBeTruthy();
    fireEvent.press(screen.getByText('Undo'));
    expect(useStore.getState().programs[0].position).toBe(0);
    expect(await screen.findByText('Next: Day 1 · Week 1')).toBeTruthy();
  });

  test('two programs and a draft: the draft card on top, the other program below, no second card for the draft', async () => {
    const a = add('GSLP', 'base');
    const b = add('Five by five', 'stronglifts');
    useStore.getState().startSession(a);
    useStore.getState().logSet('MILITARY_PRESS', 0, 5);
    await renderRouter(routes(), { initialUrl: '/' });
    expect(await screen.findByText('GSLP · Day 1')).toBeTruthy();
    expect(screen.getByText(/1 of 4 sets/)).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByTestId('resume-workout')).toBeTruthy();
    expect(screen.getByTestId(`start-${b}`)).toBeTruthy();
    expect(screen.queryByTestId(`start-${a}`)).toBeNull();
  });

  test('a paused program is listed under Paused and resumes from there', async () => {
    const a = add('GSLP', 'base');
    const b = add('Five by five', 'stronglifts');
    useStore.getState().pauseProgram(b, true);
    await renderRouter(routes(), { initialUrl: '/' });
    expect((await screen.findAllByText('Paused')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paused · A next').length).toBeGreaterThan(0);
    expect(screen.queryByTestId(`start-${b}`)).toBeNull();
    expect(screen.getByTestId(`start-${a}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`resume-${b}`));
    expect(useStore.getState().programs.find((p) => p.id === b)?.paused).toBe(false);
    expect(await screen.findByTestId(`start-${b}`)).toBeTruthy();
  });

  test('when every program is paused it says so', async () => {
    const a = add('GSLP', 'base');
    useStore.getState().pauseProgram(a, true);
    await renderRouter(routes(), { initialUrl: '/' });
    expect(await screen.findByText(/All programs are paused/)).toBeTruthy();
  });

  describe('Start while another program has an open workout', () => {
    const setup = async () => {
      const a = add('GSLP', 'base');
      const b = add('Five by five', 'stronglifts');
      useStore.getState().startSession(a);
      useStore.getState().logSet('MILITARY_PRESS', 0, 5);
      const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      const { getPathname } = await renderRouter(routes(), { initialUrl: '/' });
      fireEvent.press(await screen.findByTestId(`start-${b}`));
      return { a, b, alert, getPathname, buttons: alert.mock.calls[0][2] ?? [] };
    };

    test('asks to resume, discard or cancel and starts nothing yet', async () => {
      const { alert, buttons } = await setup();
      expect(alert.mock.calls[0][0]).toBe('Finish or discard the current workout?');
      expect(alert.mock.calls[0][1]).toBe(
        'GSLP · Day 1 is still open with 1 set logged. Close it before starting Five by five.',
      );
      expect(buttons.map((b) => b.text)).toEqual(['Resume it', 'Discard it', 'Cancel']);
      expect(useStore.getState().draft?.programName).toBe('GSLP');
    });

    test('Resume it opens the open workout', async () => {
      const { buttons, getPathname } = await setup();
      const n = useStore.getState().draft?.n;
      act(() => buttons[0].onPress?.());
      await screen.findByTestId('done-set');
      expect(getPathname()).toBe(`/session/${n}`);
    });

    test('Discard it drops the open workout and starts the chosen program', async () => {
      const { b, buttons } = await setup();
      act(() => buttons[1].onPress?.());
      await screen.findByTestId('done-set');
      const { draft, nextSession } = useStore.getState();
      expect(draft?.programId).toBe(b);
      // The discarded workout's id is never reused.
      expect(draft?.n).toBe(1);
      expect(nextSession).toBe(2);
    });

    test('Cancel changes nothing', async () => {
      const { a, buttons } = await setup();
      act(() => buttons[2].onPress?.());
      expect(useStore.getState().draft?.programId).toBe(a);
    });
  });
});

describe('Programs tab', () => {
  test('lists active, paused and saved programs and opens one', async () => {
    const a = add('GSLP', 'base');
    const b = add('Five by five', 'stronglifts');
    useStore.getState().pauseProgram(b, true);
    useStore.getState().saveCustomPlan({ id: 'mine', name: 'Push Pull Legs', program: TEMPLATES.base });
    useStore.getState().startSession(a);
    await renderRouter(routes(), { initialUrl: '/plan' });
    expect(await screen.findByText('Active')).toBeTruthy();
    expect(screen.getByText('Draft open')).toBeTruthy();
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0);
    expect(screen.getByText('My programs')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Five by five, Paused/));
    expect(await screen.findByText('Resume program')).toBeTruthy();
  });

  test('New opens the add picker', async () => {
    add('GSLP', 'base');
    await renderRouter(routes(), { initialUrl: '/plan' });
    fireEvent.press(await screen.findByTestId('new-program'));
    expect(await screen.findByRole('radio', { name: /^Phrak/ })).toBeTruthy();
    expect(screen.getByText('Hypertrophy')).toBeTruthy();
  });
});

describe('program screen', () => {
  const open = async (id: string) => {
    await renderRouter(routes(), { initialUrl: '/' });
    await screen.findByTestId(`start-${id}`);
    act(() => router.push(`/program/${id}`));
  };

  test('pauses and resumes', async () => {
    const id = add('GSLP', 'base');
    await open(id);
    fireEvent.press(await screen.findByTestId('pause-program'));
    expect(useStore.getState().programs[0].paused).toBe(true);
    expect(await screen.findByText('Resume program')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pause-program'));
    expect(useStore.getState().programs[0].paused).toBe(false);
  });

  test('renames', async () => {
    const id = add('GSLP', 'base');
    await open(id);
    fireEvent.press(await screen.findByText('Rename'));
    fireEvent.changeText(await screen.findByLabelText('Name'), '  My lifts ');
    fireEvent.press(screen.getByTestId('rename-save'));
    expect(useStore.getState().programs[0].name).toBe('My lifts');
  });

  test('an empty name cannot be saved', async () => {
    const id = add('GSLP', 'base');
    await open(id);
    fireEvent.press(await screen.findByText('Rename'));
    fireEvent.changeText(await screen.findByLabelText('Name'), '   ');
    expect(screen.getByTestId('rename-save').props.accessibilityState.disabled).toBe(true);
  });

  test('removing asks first, keeps history and the other program', async () => {
    const a = add('GSLP', 'base');
    const b = add('Five by five', 'stronglifts');
    useStore.getState().startSession(a);
    useStore.getState().finishSession();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await open(a);
    fireEvent.press(await screen.findByTestId('remove-program'));
    expect(alert.mock.calls[0][0]).toBe('Remove GSLP?');
    expect(useStore.getState().programs).toHaveLength(2);
    const remove = alert.mock.calls[0][2]?.find((x) => x.style === 'destructive');
    act(() => remove?.onPress?.());
    expect(useStore.getState().programs.map((p) => p.id)).toEqual([b]);
    expect(useStore.getState().sessions).toHaveLength(1);
  });
});

describe('adding a program', () => {
  test('a second program is added with its own weights; the first one is untouched', async () => {
    const a = add('GSLP', 'base');
    const before = JSON.stringify(useStore.getState().programs[0]);
    await renderRouter(routes(), { initialUrl: '/' });
    await screen.findByTestId(`start-${a}`);
    act(() => router.push('/setup/plan?add=1'));
    fireEvent.press(await screen.findByRole('radio', { name: /^StrongLifts/ }));
    fireEvent.press(screen.getByTestId('setup-next'));
    expect(screen.queryByText('Step 3 of 3')).toBeNull();
    fireEvent.press(await screen.findByTestId('start-training'));
    expect(await screen.findByText('Next: A · Week 1')).toBeTruthy();
    const { programs } = useStore.getState();
    expect(programs).toHaveLength(2);
    expect(programs[1].name).toBe('StrongLifts 5×5');
    expect(JSON.stringify(programs[0])).toBe(before);
  });

  test('a saved program is listed under My programs and keeps its name', async () => {
    useStore.getState().saveCustomPlan({ id: 'mine', name: 'Push Pull Legs', program: TEMPLATES.base });
    await renderRouter(routes(), { initialUrl: '/setup/plan?add=1' });
    expect(await screen.findByText('My programs')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Push Pull Legs' }));
    fireEvent.press(screen.getByTestId('setup-next'));
    fireEvent.press(await screen.findByTestId('start-training'));
    await screen.findByText(/^Next:/);
    expect(useStore.getState().programs[0].name).toBe('Push Pull Legs');
  });

  test('a category chip filters the list and a second tap clears it', async () => {
    await renderRouter(routes(), { initialUrl: '/setup/plan?add=1' });
    fireEvent.press(await screen.findByRole('radio', { name: 'Mobility' }));
    expect(screen.getByRole('radio', { name: /^Shoulder/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^Greyskull/ })).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Calisthenics' }));
    expect(screen.getByText('No programs in this category yet.')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Calisthenics' }));
    expect(screen.getByRole('radio', { name: /^Greyskull/ })).toBeTruthy();
  });

  test('every plan shows whether it fits the equipment the user has', async () => {
    useStore.getState().setEquipment(['dumbbell']);
    await renderRouter(routes(), { initialUrl: '/setup/plan?add=1' });
    expect((await screen.findAllByText(/^Missing: barbell/)).length).toBeGreaterThan(0);
  });

  test('without equipment set the badge says so', async () => {
    await renderRouter(routes(), { initialUrl: '/setup/plan?add=1' });
    expect((await screen.findAllByText('Equipment not set')).length).toBeGreaterThan(0);
  });
});

describe('Progress and History with several programs', () => {
  const play = (id: string) => {
    useStore.getState().startSession(id);
    useStore.getState().finishSession();
  };

  test('progress has a section per program, charting that program only', async () => {
    const a = add('GSLP', 'base');
    const b = add('Five by five', 'stronglifts');
    play(a);
    play(b);
    await renderRouter(routes(), { initialUrl: '/progress' });
    expect((await screen.findAllByText('GSLP')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Five by five').length).toBeGreaterThan(0);
    expect(screen.getByText('GSLP: projection')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^GSLP: Overhead press/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Five by five: Overhead press/ })).toBeTruthy();
  });

  test('history names the program of every workout, and Earlier program when it has none', async () => {
    const a = add('GSLP', 'base');
    play(a);
    useStore.setState((s) => ({
      sessions: [...s.sessions, { ...s.sessions[0], n: 50, programId: undefined, programName: undefined }],
    }));
    await renderRouter(routes(), { initialUrl: '/history' });
    expect(await screen.findByText('GSLP')).toBeTruthy();
    expect(screen.getByText('Earlier program')).toBeTruthy();
  });
});
