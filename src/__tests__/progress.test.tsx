import { act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { PLUGINS, TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function playSessions(count: number, reps: number) {
  for (let i = 0; i < count; i++) {
    const s = useStore.getState();
    const draft = s.startSession(s.nextSession);
    for (const id of draft.order)
      draft.results[id].sets.forEach((_x, j) => {
        useStore.getState().logSet(id, j, reps);
      });
    useStore.getState().finishSession();
  }
}

beforeEach(() => {
  useStore.setState({ ...initialState(), hydrated: true });
  useStore.getState().setProgram(PLUGINS.chins.apply(TEMPLATES.base));
});

test('charts render per lift in kg and lb', async () => {
  playSessions(4, 6);
  renderRouter(routes(), { initialUrl: '/progress' });
  expect(await screen.findByText('Overhead press')).toBeTruthy();
  expect(screen.getByLabelText('Overhead press: 20 kg to 22.5 kg over 2 sessions')).toBeTruthy();
  expect(screen.getAllByText('20 kg → 25 kg').length).toBeGreaterThan(0);

  await act(async () => useStore.getState().setUnit('lb'));
  expect(await screen.findByLabelText('Overhead press: 44.09 lb to 49.6 lb over 2 sessions')).toBeTruthy();
  expect(screen.getAllByText('45 lb → 55 lb').length).toBeGreaterThan(0); // start/current are snapped to lb plates
});

test('chin-ups chart reps and the last page projects nine sessions', async () => {
  playSessions(3, 7);
  renderRouter(routes(), { initialUrl: '/progress' });
  await screen.findByText('Overhead press');
  expect(screen.getByLabelText('Chin-up: 7 reps to 7 reps over 3 sessions')).toBeTruthy();
  expect(screen.getByText('Projection')).toBeTruthy();
  const rows = screen.getAllByText(/^#\d+ Day \d/);
  expect(rows).toHaveLength(9);
  expect(rows[0].props.children).toMatch(/^#4 Day 1/);
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
