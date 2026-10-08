import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { PLUGINS, TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

function playSessions(count: number, reps: number) {
  for (let i = 0; i < count; i++) {
    const s = useStore.getState();
    const draft = s.startSession(s.nextSession);
    for (const id of draft.order) {
      draft.results[id].sets.forEach((_x, j) => {
        useStore.getState().logSet(id, j, reps);
      });
    }
    useStore.getState().finishSession();
  }
}

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  useStore.getState().setProgram(PLUGINS.chins.apply(TEMPLATES.base));
});

test('the progress tab lists every lift with its current weight and trend', async () => {
  playSessions(4, 6);
  renderRouter(routes(), { initialUrl: '/progress' });
  expect(
    await screen.findByRole('button', { name: /^Overhead press, 25 kg\. \+2\.5 kg since the start/ }),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Squat, 27.5 kg/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Chin-up, 6 reps/ })).toBeTruthy();
  expect(screen.getByText('Projection')).toBeTruthy();
  const rows = screen.getAllByText(/^Workout \d+ · Day \d/);
  expect(rows).toHaveLength(6);
  expect(rows[0].props.children).toBe('Workout 5 · Day 2');
});

test('lifts without a trend get one shared note, not a line each', async () => {
  playSessions(1, 6);
  renderRouter(routes(), { initialUrl: '/progress' });
  expect(await screen.findByText('Trends show once a lift has 2 workouts.')).toBeTruthy();
  expect(screen.queryByText('Not enough sessions yet')).toBeNull();
});

test('an empty progress tab explains what to do', async () => {
  renderRouter(routes(), { initialUrl: '/progress' });
  expect(await screen.findByText('Nothing to chart yet')).toBeTruthy();
});

test('a lift opens its chart in kg and lb, and a bodyweight lift charts reps', async () => {
  playSessions(4, 6);
  renderRouter(routes(), { initialUrl: '/progress' });
  fireEvent.press(await screen.findByRole('button', { name: /^Overhead press/ }));
  expect(await screen.findByLabelText('Overhead press: 20 kg to 22.5 kg over 2 sessions')).toBeTruthy();
  expect(screen.getAllByText('20 kg → 25 kg').length).toBeGreaterThan(0);

  await act(async () => useStore.getState().setUnit('lb'));
  expect(await screen.findByLabelText('Overhead press: 44.09 lb to 49.6 lb over 2 sessions')).toBeTruthy();
  expect(screen.getAllByText('45 lb → 55 lb').length).toBeGreaterThan(0);

  act(() => router.push('/lift/CHINUPS'));
  expect(await screen.findByLabelText('Chin-up: 6 reps to 6 reps over 4 sessions')).toBeTruthy();
});

test('the chart range chips filter sessions and the tooltip defaults to the latest one', async () => {
  playSessions(3, 6);
  renderRouter(routes(), { initialUrl: '/lift/BARBELL_SQUAT' });
  expect(await screen.findByLabelText('Squat: 20 kg to 22.5 kg over 2 sessions')).toBeTruthy();
  fireEvent.press(screen.getByRole('radio', { name: '3M' }));
  expect(screen.getByLabelText('Squat: 20 kg to 22.5 kg over 2 sessions')).toBeTruthy();
  expect(screen.getAllByText(/· 6 reps/).length).toBeGreaterThan(0);
});

test('editing a past session changes its record, not the current lifts', async () => {
  playSessions(3, 6);
  const liftsBefore = JSON.stringify(useStore.getState().lifts);
  renderRouter(routes(), { initialUrl: '/' });
  act(() => router.push('/session/edit/0'));
  expect(await screen.findByText(/Changing a past session does not recalculate/)).toBeTruthy();
  // Session 0 is press then squat, each with [weight, set 1, set 2] steppers.
  const increase = () => screen.getAllByLabelText('Increase');
  fireEvent.press(increase()[5]); // squat AMRAP 6 → 7
  fireEvent.press(increase()[3]); // squat weight 20 → 22.5
  fireEvent.press(screen.getByText('Save'));
  const squat = useStore.getState().sessions[0].results.BARBELL_SQUAT;
  expect(squat.sets[1].reps).toBe(7);
  expect(squat.weightKg).toBe(22.5);
  expect(JSON.stringify(useStore.getState().lifts)).toBe(liftsBefore);
});

test('the full history lists every workout, newest first', async () => {
  playSessions(3, 6);
  renderRouter(routes(), { initialUrl: '/history' });
  const rows = await screen.findAllByRole('button', { name: /^Session \d+, edit$/ });
  expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
    'Session 3, edit',
    'Session 2, edit',
    'Session 1, edit',
  ]);
});
