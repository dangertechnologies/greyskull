import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { routes } from '../testRoutes';

function seed(minimalist: boolean) {
  useStore.setState({ ...initialState(), hydrated: true });
  const s = useStore.getState();
  s.setProgram(TEMPLATES.base);
  s.setLift('BARBELL_SQUAT', { weightKg: 100 });
  s.setSettings({ minimalist, restSeconds: 0 });
}

const lifts = () => JSON.parse(JSON.stringify(useStore.getState().lifts)) as Record<string, unknown>;

test('circles: tap logs the target, tap again counts down to empty, long-press edits reps', async () => {
  seed(true);
  renderRouter(routes(), { initialUrl: '/session/0' });
  expect(await screen.findByLabelText('Warm-up 1 of 1, 20 kg ×5')).toBeTruthy(); // press: bar only
  for (const w of ['20 kg ×5', '55 kg ×4', '70 kg ×3', '85 kg ×2'])
    expect(screen.getAllByText(w).length).toBeGreaterThan(0);
  // A warm-up ticks off without touching the logged sets.
  const before = JSON.stringify(useStore.getState().draft?.results);
  fireEvent.press(screen.getByLabelText('Warm-up 2 of 4, 55 kg ×4'));
  expect(screen.getByLabelText('Warm-up 2 of 4, 55 kg ×4, done')).toBeTruthy();
  expect(JSON.stringify(useStore.getState().draft?.results)).toBe(before);

  const first = screen.getAllByLabelText(/^Set 1 of 2, target 5$/)[0];
  fireEvent.press(first);
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(5);
  fireEvent.press(screen.getAllByLabelText(/^Set 1 of 2, 5 reps done$/)[0]);
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(4);
  for (let i = 0; i < 4; i++) fireEvent.press(screen.getAllByLabelText(/^Set 1 of 2, \d reps done$/)[0]);
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[0].reps).toBe(0);
  expect(screen.getAllByLabelText(/^Set 1 of 2, target 5$/).length).toBe(2);

  const amrap = screen.getAllByLabelText(/^Set 2 of 2, target as many as possible$/)[0];
  fireEvent(amrap, 'longPress');
  for (let i = 0; i < 7; i++) fireEvent.press(screen.getByLabelText('Increase')); // 5 → 12
  fireEvent.press(screen.getByText('Done'));
  expect(useStore.getState().draft?.results.MILITARY_PRESS.sets[1].reps).toBe(12);
  expect(screen.queryByText('Finish workout')).toBeNull();
});

test('rest bar counts down after a circle and can be skipped', async () => {
  seed(true);
  useStore.getState().setSettings({ restSeconds: 90 });
  renderRouter(routes(), { initialUrl: '/session/0' });
  fireEvent.press((await screen.findAllByLabelText(/^Set 1 of 2, target 5$/))[0]);
  expect((await screen.findByTestId('rest-remaining')).props.children).toBe('1:30');
  fireEvent.press(screen.getByTestId('rest-skip'));
  expect(screen.queryByTestId('rest-remaining')).toBeNull();
});

test('minimal and immersive views give identical progression for the same reps', async () => {
  // Minimal: press 5 + AMRAP 12 (long-press), squat 5 + AMRAP 4 (long-press), then Finish.
  seed(true);
  renderRouter(routes(), { initialUrl: '/session/0' });
  const [pressSet1, squatSet1] = await screen.findAllByLabelText(/^Set 1 of 2, target 5$/);
  fireEvent.press(pressSet1);
  fireEvent.press(squatSet1);
  const [pressAmrap, squatAmrap] = screen.getAllByLabelText(/^Set 2 of 2, target as many as possible$/);
  fireEvent(pressAmrap, 'longPress');
  for (let i = 0; i < 7; i++) fireEvent.press(screen.getByLabelText('Increase'));
  fireEvent.press(screen.getByText('Done'));
  fireEvent(squatAmrap, 'longPress');
  fireEvent.press(screen.getByLabelText('Decrease'));
  fireEvent.press(screen.getByText('Done'));
  fireEvent.press(await screen.findByText('Finish workout'));
  await screen.findByText('Workout complete');
  const minimal = lifts();
  const minimalLog = JSON.stringify(useStore.getState().sessions[0].results);

  // Immersive from the same starting state.
  seed(false);
  act(() => void 0);
  const rendered = renderRouter(routes(), { initialUrl: '/session/0' });
  await screen.findByText('Warm-up 1 of 1');
  const press = () => fireEvent.press(screen.getByText('Done'));
  press();
  press(); // press warm-up, set 1
  for (let i = 0; i < 7; i++) fireEvent.press(screen.getByLabelText('Increase'));
  press();
  for (let i = 0; i < 5; i++) press(); // 4 squat warm-ups + set 1
  fireEvent.press(screen.getByLabelText('Decrease'));
  press();
  fireEvent.press(await screen.findByText('Finish workout'));
  await screen.findByText('Workout complete');

  expect(lifts()).toEqual(minimal);
  expect(JSON.stringify(useStore.getState().sessions[0].results)).toBe(minimalLog);
  rendered.unmount();
});
