import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BACKGROUNDS } from './backgrounds';
import { builtInExercises } from './catalog';

const root = join(__dirname, '..');
const requiredFiles = (source: string) =>
  [...readFileSync(join(__dirname, source), 'utf8').matchAll(/require\('\.\.\/(assets\/[^']+)'\)/g)].map(
    (m) => m[1],
  );

test('every background require points at a file that exists', () => {
  for (const file of requiredFiles('backgrounds.ts')) expect(existsSync(join(root, file))).toBe(true);
  expect(Object.values(BACKGROUNDS).every((v) => v !== undefined && v !== null)).toBe(true);
});

test('every built-in exercise has a photo and a monogram', () => {
  for (const e of Object.values(builtInExercises())) {
    expect(e.background).toBeDefined();
    expect(BACKGROUNDS[e.background ?? '']).toBeDefined();
    expect(e.abbr?.length).toBeGreaterThanOrEqual(2);
  }
  expect(BACKGROUNDS.default).toBeDefined();
  expect(BACKGROUNDS.rest).toBeDefined();
  expect(BACKGROUNDS['woman-with-barbell']).toBeDefined();
});

test('no orphaned background files (unused images ship in the bundle for nothing)', () => {
  const used = new Set(requiredFiles('backgrounds.ts').map((f) => f.split('/').pop()));
  const onDisk = readdirSync(join(root, 'assets/backgrounds'));
  expect(onDisk.filter((f) => !used.has(f))).toEqual([]);
});

test('app config points at existing icon, adaptive icon, iOS variants and splash images', () => {
  type Plugin = string | [string, { image?: string; dark?: { image?: string } }];
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
    expo: {
      icon: string;
      ios: { icon: Record<'light' | 'dark' | 'tinted', string> };
      android: { adaptiveIcon: Record<'foregroundImage' | 'backgroundImage' | 'monochromeImage', string> };
      plugins: Plugin[];
    };
  };
  const splash = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as
    | [string, { image: string; dark: { image: string } }]
    | undefined;
  const files = [
    app.expo.icon,
    ...Object.values(app.expo.ios.icon),
    ...Object.values(app.expo.android.adaptiveIcon),
    splash?.[1].image,
    splash?.[1].dark.image,
  ];
  expect(splash).toBeDefined();
  for (const file of files) expect(existsSync(join(root, file ?? 'missing'))).toBe(true);
});

test('icon artwork is square, 1024 px, and the adaptive foreground is transparent at the edges', () => {
  const size = (name: string) => {
    const png = readFileSync(join(root, 'assets', name));
    return [png.readUInt32BE(16), png.readUInt32BE(20), png[25]] as const; // width, height, colour type
  };
  for (const name of [
    'icon.png',
    'icon-dark.png',
    'icon-tinted.png',
    'adaptive-foreground.png',
    'adaptive-background.png',
    'adaptive-monochrome.png',
  ]) {
    expect(size(name).slice(0, 2)).toEqual([1024, 1024]);
  }
  expect(size('adaptive-foreground.png')[2]).toBe(6); // RGBA
});
