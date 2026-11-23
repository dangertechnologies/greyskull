import { act, renderHook } from '@testing-library/react-native';
import { TEMPLATES } from '../domain';
import { initialState, useStore } from '../store';
import { useNow } from './useNow';
import { useProgramById } from './useProgramById';

beforeEach(() => useStore.setState({ ...initialState(), hydrated: true }));

describe('useProgramById', () => {
  test('finds a program by id and never falls back to another one', () => {
    const a = useStore.getState().addProgram({ ...TEMPLATES.base, name: 'A' });
    expect(renderHook(() => useProgramById(a)).result.current?.id).toBe(a);
    expect(renderHook(() => useProgramById(undefined)).result.current).toBeUndefined();
    expect(renderHook(() => useProgramById('')).result.current).toBeUndefined();
    expect(renderHook(() => useProgramById('nope')).result.current).toBeUndefined();
  });
});

describe('useNow', () => {
  afterEach(() => jest.useRealTimers());

  test('ticks while mounted and stops after unmount', () => {
    jest.useFakeTimers({ now: new Date('2026-11-23T10:00:00Z') });
    const { result, unmount } = renderHook(() => useNow(30_000));
    const first = result.current;
    act(() => jest.advanceTimersByTime(30_000));
    expect(result.current - first).toBe(30_000);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
