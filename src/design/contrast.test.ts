import { type ColorRole, palettes, type Scheme } from './tokens';

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT: ColorRole[] = ['text', 'textMuted', 'accent', 'success', 'warning', 'danger'];
const GROUNDS: ColorRole[] = ['background', 'surface', 'surfaceRaised'];

describe.each<Scheme>(['dark', 'light'])('%s palette', (scheme) => {
  const p = palettes[scheme];
  test.each(TEXT.flatMap((fg) => GROUNDS.map((bg) => [fg, bg] as const)))('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });
  test('text on the accent colour ≥ 4.5:1', () => {
    expect(ratio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });
  test('control outlines are ≥ 3:1 on surfaces', () => {
    expect(ratio(p.borderStrong, p.surface)).toBeGreaterThanOrEqual(3);
    expect(ratio(p.borderStrong, p.background)).toBeGreaterThanOrEqual(3);
  });
});
