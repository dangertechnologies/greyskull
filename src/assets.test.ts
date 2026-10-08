import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BACKGROUNDS } from './backgrounds';
import { builtInExercises } from './catalog';
import { ICONS } from './icons';

const root = join(__dirname, '..');
const requiredFiles = (source: string) =>
  [...readFileSync(join(__dirname, source), 'utf8').matchAll(/require\('\.\.\/(assets\/[^']+)'\)/g)].map(
    (m) => m[1],
  );

test('every background and icon require points at a file that exists', () => {
  for (const file of [...requiredFiles('backgrounds.ts'), ...requiredFiles('icons.ts')]) {
    expect(existsSync(join(root, file))).toBe(true);
  }
  expect(Object.values(BACKGROUNDS).every((v) => v !== undefined && v !== null)).toBe(true);
  expect(Object.values(ICONS).every((v) => v !== undefined && v !== null)).toBe(true);
});

test('every built-in exercise uses a known icon and background', () => {
  for (const e of Object.values(builtInExercises())) {
    expect(ICONS[e.icon]).toBeDefined();
    if (e.background) expect(BACKGROUNDS[e.background]).toBeDefined();
  }
  expect(BACKGROUNDS.default).toBeDefined();
});

test('no orphaned background files (unused images ship in the bundle for nothing)', () => {
  const used = new Set(requiredFiles('backgrounds.ts').map((f) => f.split('/').pop()));
  const onDisk = readdirSync(join(root, 'assets/backgrounds'));
  expect(onDisk.filter((f) => !used.has(f))).toEqual([]);
});

test('app config points at existing icon and splash images', () => {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
    expo: { icon: string; splash: { image: string } };
  };
  expect(existsSync(join(root, app.expo.icon))).toBe(true);
  expect(existsSync(join(root, app.expo.splash.image))).toBe(true);
});
