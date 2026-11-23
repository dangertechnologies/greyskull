import {
  boundaries,
  buzzes,
  elapsedMs,
  end,
  isPaused,
  nextBoundaryAt,
  pause,
  planOf,
  positionAt,
  resume,
  skip,
  start,
  totalS,
} from './clock';

const emom10 = planOf({ id: 'g', kind: 'emom', minutes: 10 }, 10);
const tabata = planOf({ id: 'g', kind: 'interval', rounds: 8, workS: 20, restS: 10 }, 8);

test('plans: an EMOM is one work minute per step, an interval work then rest', () => {
  expect(emom10).toEqual({ steps: 10, workS: 60, restS: 0 });
  expect(tabata).toEqual({ steps: 8, workS: 20, restS: 10 });
  expect(totalS(emom10)).toBe(600);
  expect(totalS(tabata)).toBe(240);
});

test('position comes from the start anchor, whatever happened in between', () => {
  const a = start(1_000);
  expect(positionAt(emom10, a, 1_000)).toMatchObject({ step: 0, phase: 'work', remainingS: 60, done: false });
  // 3 minutes 23 seconds later: minute 4, 37 s left (the mockup).
  expect(positionAt(emom10, a, 1_000 + 203_000)).toMatchObject({ step: 3, phase: 'work', remainingS: 37 });
  expect(positionAt(tabata, a, 1_000 + 65_000)).toMatchObject({ step: 2, phase: 'work', remainingS: 15 });
  expect(positionAt(tabata, a, 1_000 + 85_000)).toMatchObject({ step: 2, phase: 'rest', remainingS: 5 });
  expect(positionAt(emom10, a, 1_000 + 600_000)).toMatchObject({ done: true, step: 9 });
});

test('a pause stops the clock until resumed; pausing twice or resuming a running timer changes nothing', () => {
  let a = start(0);
  a = pause(a, 10_000);
  expect(isPaused(a)).toBe(true);
  expect(pause(a, 11_000)).toBe(a);
  expect(elapsedMs(a, 50_000)).toBe(10_000);
  a = resume(a, 50_000);
  expect(resume(a, 51_000)).toBe(a);
  expect(isPaused(a)).toBe(false);
  expect(elapsedMs(a, 60_000)).toBe(20_000);
  a = resume(pause(a, 70_000), 75_000);
  expect(elapsedMs(a, 80_000)).toBe(35_000);
});

test('skip jumps to the start of the next step', () => {
  const a = skip(emom10, start(0), 12_000);
  expect(positionAt(emom10, a, 12_000)).toMatchObject({ step: 1, remainingS: 60 });
  expect(positionAt(emom10, a, 72_000)).toMatchObject({ step: 2 });
  // From an interval's rest phase, too.
  const b = skip(tabata, start(0), 25_000);
  expect(positionAt(tabata, b, 25_000)).toMatchObject({ step: 1, phase: 'work', remainingS: 20 });
  // Skipping the last step ends the timer.
  expect(positionAt(emom10, skip(emom10, start(0), 550_000), 550_000).done).toBe(true);
});

test('end early stops the timer where it was', () => {
  const a = end(start(0), 130_000);
  expect(positionAt(emom10, a, 500_000)).toMatchObject({ done: true, step: 2 });
  expect(end(a, 200_000)).toBe(a);
});

test('boundaries: every future step and rest start, in seconds from now', () => {
  expect(boundaries(emom10, start(0), 0).map((b) => b.inS)).toEqual([
    60, 120, 180, 240, 300, 360, 420, 480, 540, 600,
  ]);
  const late = boundaries(tabata, start(0), 205_000);
  expect(late).toEqual([
    { inS: 5, step: 7, phase: 'work' },
    { inS: 25, step: 7, phase: 'rest' },
    { inS: 35, step: 8, phase: 'done' },
  ]);
  expect(boundaries(emom10, pause(start(0), 10_000), 20_000)).toEqual([]);
  expect(boundaries(emom10, end(start(0), 10_000), 20_000)).toEqual([]);
});

test('buzzes once per boundary, never on the first look (a relaunch)', () => {
  const a = start(0);
  const at = (ms: number) => positionAt(emom10, a, ms);
  expect(buzzes(null, at(5_000))).toBe(false);
  expect(buzzes(at(5_000), at(6_000))).toBe(false);
  expect(buzzes(at(59_000), at(60_000))).toBe(true);
  expect(buzzes(at(60_000), at(61_000))).toBe(false);
  expect(buzzes(at(599_000), at(600_000))).toBe(true);
  const r = start(0);
  expect(buzzes(positionAt(tabata, r, 19_000), positionAt(tabata, r, 20_000))).toBe(true);
});

test('the next boundary as a wall-clock time, frozen while paused', () => {
  const a = start(1_000);
  expect(nextBoundaryAt(emom10, a, 1_000 + 23_000)).toBe(61_000);
  expect(nextBoundaryAt(tabata, a, 1_000 + 25_000)).toBe(31_000);
  const p = pause(a, 11_000);
  // 50 s were left at the pause; the countdown shows 50 s ending 50 s after the pause.
  expect(nextBoundaryAt(emom10, p, 99_000)).toBe(61_000);
});
