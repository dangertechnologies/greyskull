import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as KeepAwake from 'expo-keep-awake';
import { useStopwatch } from './useStopwatch';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test('keeps time from timestamps, so time away from the screen still counts', () => {
  const { result } = renderHook(() => useStopwatch(30));
  act(() => result.current.start());
  // The clock jumps without the interval firing (as when the app was in the background).
  jest.setSystemTime(Date.now() + 12_400);
  act(() => void jest.advanceTimersByTime(250));
  expect(result.current.seconds).toBe(12);
  expect(result.current.running).toBe(true);
});

test('pause and resume add up; reset clears', () => {
  const { result } = renderHook(() => useStopwatch(30));
  act(() => result.current.start());
  act(() => void jest.advanceTimersByTime(5_000));
  act(() => result.current.pause());
  act(() => void jest.advanceTimersByTime(60_000));
  expect(result.current.seconds).toBe(5);
  expect(result.current.running).toBe(false);
  act(() => result.current.start());
  act(() => void jest.advanceTimersByTime(3_000));
  expect(result.current.seconds).toBe(8);
  act(() => result.current.reset());
  expect(result.current.seconds).toBe(0);
  expect(result.current.running).toBe(false);
});

test('buzzes once at the target', () => {
  const buzz = jest.spyOn(Haptics, 'notificationAsync').mockResolvedValue(undefined);
  const { result } = renderHook(() => useStopwatch(10));
  act(() => result.current.start());
  act(() => void jest.advanceTimersByTime(9_000));
  expect(buzz).not.toHaveBeenCalled();
  act(() => void jest.advanceTimersByTime(2_000));
  act(() => void jest.advanceTimersByTime(5_000));
  expect(buzz).toHaveBeenCalledTimes(1);
});

test('keeps the screen awake only while running', () => {
  const { result, unmount } = renderHook(() => useStopwatch(30));
  expect(KeepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();
  act(() => result.current.start());
  expect(KeepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
  act(() => result.current.pause());
  expect(KeepAwake.deactivateKeepAwake).toHaveBeenCalledTimes(1);
  act(() => result.current.start());
  unmount();
  expect(KeepAwake.deactivateKeepAwake).toHaveBeenCalledTimes(2);
});
