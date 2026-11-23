import { PICTOGRAM_KEYS, PICTOGRAMS } from './pictograms';

// Absolute commands only, with how many numbers each takes and which of them are x (0) or y (1) coordinates.
const AXES: Record<string, number[]> = {
  M: [0, 1],
  L: [0, 1],
  H: [0],
  V: [1],
  C: [0, 1, 0, 1, 0, 1],
  Q: [0, 1, 0, 1],
  Z: [],
};

/** Returns every coordinate in the path as [axis, value], or throws on anything the app's style does not use. */
function coordinates(d: string): [number, number][] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  expect(tokens.join('')).toBe(d.replace(/[\s,]+/g, ''));
  const out: [number, number][] = [];
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    const axes = AXES[command];
    if (!axes) throw new Error(`unsupported path command ${command} in ${d}`);
    do {
      for (const axis of axes) {
        const value = Number(tokens[i++]);
        if (Number.isNaN(value)) throw new Error(`missing number after ${command} in ${d}`);
        out.push([axis, value]);
      }
    } while (axes.length > 0 && i < tokens.length && !AXES[tokens[i]]);
  }
  return out;
}

describe('PICTOGRAMS', () => {
  test('has exactly the agreed keys', () => {
    expect(Object.keys(PICTOGRAMS).sort()).toEqual([...PICTOGRAM_KEYS].sort());
    expect(new Set(PICTOGRAM_KEYS).size).toBe(51);
  });

  test.each(PICTOGRAM_KEYS)('%s parses and stays inside the 32 × 32 grid', (key) => {
    const p = PICTOGRAMS[key];
    expect(p.d).toMatch(/^M/);
    for (const [, v] of coordinates(p.d)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(32);
    }
    for (const [cx, cy, r] of [...(p.dots ?? []), ...(p.rings ?? [])]) {
      expect(Math.min(cx - r, cy - r)).toBeGreaterThanOrEqual(0);
      expect(Math.max(cx + r, cy + r)).toBeLessThanOrEqual(32);
    }
  });

  test('no two keys share a drawing', () => {
    const drawings = PICTOGRAM_KEYS.map((k) => PICTOGRAMS[k].d);
    expect(new Set(drawings).size).toBe(drawings.length);
  });

  test('the path checker rejects relative and arc commands', () => {
    expect(() => coordinates('M1 1 l2 2')).toThrow();
    expect(() => coordinates('M1 1 A2 2 0 0 1 3 3')).toThrow();
  });
});
