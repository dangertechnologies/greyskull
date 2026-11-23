import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HealthSettings from '../../app/settings/health';
import { initialState, useStore } from '../store';
import { initialHealthStatus, type Permission, useHealthStatus } from './status';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.Platform.OS = 'ios';
  return rn;
});

const mockPlatform = {
  permission: 'undetermined' as Permission,
  request: 'granted' as Permission,
  written: [] as string[],
  settings: jest.fn(),
};
jest.mock('./platform', () => ({
  createPlatform: () => ({
    permission: async () => mockPlatform.permission,
    request: async () => {
      mockPlatform.permission = mockPlatform.request;
      return mockPlatform.request;
    },
    write: async (w: { id: string }) => {
      mockPlatform.written.push(w.id);
    },
    openSettings: () => mockPlatform.settings(),
  }),
}));

beforeEach(() => {
  mockPlatform.permission = 'undetermined';
  mockPlatform.request = 'granted';
  mockPlatform.written = [];
  useStore.setState({ ...initialState(), hydrated: true });
  useHealthStatus.setState(initialHealthStatus());
});

test('turning the switch on asks for permission and switches sync on', async () => {
  render(<HealthSettings />);
  await act(async () => {
    fireEvent(screen.getByLabelText('Save workouts to Health'), 'valueChange', true);
  });
  await waitFor(() => expect(useStore.getState().healthSync).toBe(true));
  expect(await screen.findByText('Allowed')).toBeTruthy();
});

test('a refusal leaves sync off and shows the warning and the settings button', async () => {
  mockPlatform.request = 'denied';
  render(<HealthSettings />);
  await act(async () => {
    fireEvent(screen.getByLabelText('Save workouts to Health'), 'valueChange', true);
  });
  expect(await screen.findByText(/Health access is off for Greyskull/)).toBeTruthy();
  expect(useStore.getState().healthSync).toBe(false);
  expect(screen.getByRole('button', { name: 'Export past workouts' }).props.accessibilityState.disabled).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Open system Settings' }));
  expect(mockPlatform.settings).toHaveBeenCalled();
});

test('Export sends every finished workout and says how many', async () => {
  mockPlatform.permission = 'granted';
  useStore.setState({
    sessions: [
      {
        n: 1,
        dayName: 'A',
        startedAt: '2026-11-01T08:00:00.000Z',
        finishedAt: '2026-11-01T09:00:00.000Z',
        results: {},
        order: [],
      },
      {
        n: 2,
        dayName: 'B',
        startedAt: '2026-11-02T08:00:00.000Z',
        finishedAt: '2026-11-02T09:00:00.000Z',
        results: {},
        order: [],
        skipped: true,
      },
    ],
  });
  render(<HealthSettings />);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Export past workouts' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Export past workouts' }));
  });
  expect(await screen.findByText('Sent 1 workout.')).toBeTruthy();
  expect(mockPlatform.written).toEqual(['greyskull-2026-11-01T08:00:00.000Z-1']);
});
