import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { active } from '../__fixtures__/oneProgram';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { AppIntentsBridge } from './Bridge';

const mockPathname = jest.fn(() => '/');
const mockModule = {
  isAvailable: jest.fn(() => true),
  setEntityCatalogAsync: jest.fn(async () => undefined),
  removePendingInvocationAsync: jest.fn(async () => undefined),
  // A subscription without remove(), as the automatic native mock gives.
  addAppIntentListener: jest.fn((_listener: (i: unknown) => void) => ({})),
  getPendingInvocationsAsync: jest.fn(async (): Promise<unknown[]> => []),
};
jest.mock('expo-app-intents', () => mockModule);
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), push: jest.fn() },
  useRootNavigationState: () => ({ key: 'ready' }),
  usePathname: () => mockPathname(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockModule.isAvailable.mockReturnValue(true);
  mockPathname.mockReturnValue('/');
  useStore.setState({ ...initialState(), hydrated: true });
});

describe('AppIntentsBridge', () => {
  test('a subscription without remove() does not crash on unmount', () => {
    const view = render(<AppIntentsBridge />);
    expect(() => view.unmount()).not.toThrow();
  });

  test('a listener that throws when added does not crash the app', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockModule.addAppIntentListener.mockImplementationOnce(() => {
      throw new Error('no native module');
    });
    expect(() => render(<AppIntentsBridge />).unmount()).not.toThrow();
    warn.mockRestore();
  });

  test('a queued invocation is handled once and removed, even when it also arrives live', async () => {
    const invocation = { id: 'i1', name: 'makeProgram', params: { text: 'dips' }, createdAt: Date.now() };
    mockModule.getPendingInvocationsAsync.mockResolvedValueOnce([invocation]);
    render(<AppIntentsBridge />);
    const live = mockModule.addAppIntentListener.mock.calls[0][0];
    await act(async () => {
      live(invocation);
    });
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/generate/describe?text=dips');
    expect(mockModule.removePendingInvocationAsync).toHaveBeenCalledWith('i1');
  });

  test('an invocation this build does not know stays queued', async () => {
    mockModule.getPendingInvocationsAsync.mockResolvedValueOnce([
      { id: 'x', name: 'later', params: {}, createdAt: Date.now() },
    ]);
    render(<AppIntentsBridge />);
    await act(async () => undefined);
    expect(mockModule.removePendingInvocationAsync).not.toHaveBeenCalled();
  });

  test('publishes the next workout and the programs once the store has loaded, and again on a change', async () => {
    jest.useFakeTimers();
    try {
      render(<AppIntentsBridge />);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      expect(mockModule.setEntityCatalogAsync).toHaveBeenCalledWith('nextWorkout', expect.any(Array));
      expect(mockModule.setEntityCatalogAsync).toHaveBeenCalledWith('program', []);
      mockModule.setEntityCatalogAsync.mockClear();
      await act(async () => {
        useStore.setState({ programs: [active(TEMPLATES.base, 0, {})] });
        await jest.advanceTimersByTimeAsync(300);
      });
      expect(mockModule.setEntityCatalogAsync).toHaveBeenCalledWith(
        'program',
        expect.arrayContaining([expect.objectContaining({ title: 'Test program' })]),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('two quick requests for the same session open it through navigate, never a second push', async () => {
    useStore.setState({ programs: [active(TEMPLATES.base, 0, {})] });
    const ask = (id: string) => ({
      id,
      name: 'startWorkout',
      params: { programId: 'test' },
      createdAt: Date.now(),
    });
    render(<AppIntentsBridge />);
    const live = mockModule.addAppIntentListener.mock.calls[0][0];
    await act(async () => {
      live(ask('1'));
      live(ask('2'));
    });
    expect(router.push).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/session/0?program=test');
  });

  test('already on that session: nothing is opened', async () => {
    useStore.setState({ programs: [active(TEMPLATES.base, 0, {})] });
    mockPathname.mockReturnValue('/session/0');
    render(<AppIntentsBridge />);
    const live = mockModule.addAppIntentListener.mock.calls[0][0];
    await act(async () => {
      live({ id: '1', name: 'startWorkout', params: { programId: 'test' }, createdAt: Date.now() });
    });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockModule.removePendingInvocationAsync).toHaveBeenCalledWith('1');
  });

  test('does nothing when the native module is unavailable', async () => {
    mockModule.isAvailable.mockReturnValue(false);
    render(<AppIntentsBridge />);
    await act(async () => undefined);
    expect(mockModule.setEntityCatalogAsync).not.toHaveBeenCalled();
    expect(mockModule.addAppIntentListener).not.toHaveBeenCalled();
  });
});
