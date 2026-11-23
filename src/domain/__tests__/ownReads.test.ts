import { programId, setProgram } from '../../__fixtures__/oneProgram';
import { builtInExercises } from '../../catalog';
import { nameOf, summarize } from '../../format';
import { initialState, useStore } from '../../store';
import { lastResult } from '../history';
import { own } from '../own';
import { TEMPLATES } from '../program';
import type { SessionLog } from '../types';

const HOSTILE = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
const ex = builtInExercises();

test('own reads only the object itself', () => {
  expect(own({ a: 1 }, 'a')).toBe(1);
  expect(own({ a: 1 }, 'b')).toBeUndefined();
  expect(own(undefined, 'a')).toBeUndefined();
  expect(own({ a: 1 }, undefined)).toBeUndefined();
  for (const key of HOSTILE) expect(own({}, key)).toBeUndefined();
  // A key that is really there is found, whatever its name.
  const parsed = JSON.parse('{"__proto__": 7, "toString": 8}') as Record<string, number>;
  expect(own(parsed, '__proto__')).toBe(7);
  expect(own(parsed, 'toString')).toBe(8);
});

describe.each(HOSTILE)('%s as an id in data read from outside', (id) => {
  test('names and summaries never read an inherited member', () => {
    expect(nameOf(ex, id)).toBe(id);
    const log = { n: 1, dayName: '', startedAt: '', order: [id], results: {} } as unknown as SessionLog;
    expect(summarize(log, ex, 'kg')).toBe('');
    expect(lastResult([log], id)).toBeNull();
  });

  test('setLift refuses it and creates no lift', () => {
    useStore.setState({ ...initialState(), hydrated: true });
    setProgram(TEMPLATES.base);
    expect(() => useStore.getState().setLift(programId(), id, { weightKg: 50 })).toThrow(/lift/i);
    expect(() => useStore.getState().setLift(programId(), `${id}@T2`, { weightKg: 50 })).toThrow(/lift/i);
    const lifts = useStore.getState().programs[0].lifts;
    expect(Object.keys(lifts)).not.toContain(id);
  });
});
