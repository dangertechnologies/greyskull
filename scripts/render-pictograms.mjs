// Renders every exercise pictogram to one contact sheet per theme in docs/pictograms/, each drawing at 64 px and
// 24 px, with the original exercise and kind drawings at the end for comparison. Rasterizes through headless
// Google Chrome, so it needs no dependencies.
//
//   node --experimental-strip-types scripts/render-pictograms.mjs
//
// (Node 22.18 and later strip TypeScript types without the flag.) Set CHROME to use another Chrome binary.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The app's sources import each other without the .ts extension (Metro resolves it); teach Node the same.
register(
  `data:text/javascript,${encodeURIComponent(
    'export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) {' +
      " if (s.startsWith('.') && !s.endsWith('.ts')) return next(s + '.ts', c); throw e; } }",
  )}`,
);
const { palettes } = await import('../src/design/tokens.ts');
const { EXERCISE_ICONS, KIND_ICONS } = await import('../src/ui/exerciseIcons.ts');
const { PICTOGRAMS } = await import('../src/ui/pictograms.ts');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/pictograms');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const COLUMNS = 8;
const CELL_W = 150;
const CELL_H = 124;

// Same drawing rules as ExerciseBadge: stroke 2, round caps and joins, heads filled.
function svg(p, size, color) {
  const rings = (p.rings ?? []).map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
  const dots = (p.dots ?? [])
    .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`)
    .join('');
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 32 32"><g stroke="${color}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="${p.d}"/>${rings}${dots}</g></svg>`
  );
}

function page(scheme) {
  const c = palettes[scheme];
  const cell = (label, p) =>
    `<div class="cell"><div class="row"><span class="badge">${svg(p, 64, c.accent)}</span>` +
    `<span class="small">${svg(p, 24, c.accent)}</span></div><div class="label">${label}</div></div>`;
  const section = (title, entries) =>
    `<h2>${title}</h2><div class="grid">${entries.map(([k, p]) => cell(k, p)).join('')}</div>`;
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 16px; background: ${c.background}; color: ${c.text}; font: 12px -apple-system, sans-serif; }
    h2 { font-size: 14px; margin: 8px 0; color: ${c.textMuted}; }
    .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, ${CELL_W}px); gap: 0; }
    .cell { height: ${CELL_H - 16}px; padding: 8px 0; display: flex; flex-direction: column; align-items: center; }
    .row { display: flex; align-items: center; gap: 12px; }
    .badge { width: 88px; height: 88px; border-radius: 44px; background: ${c.chartFill}; display: flex;
      align-items: center; justify-content: center; }
    .small { width: 24px; height: 24px; }
    .label { margin-top: 6px; }
  </style>
  ${section('Pictograms', Object.entries(PICTOGRAMS))}
  ${section('Original exercise and kind drawings', [
    ...Object.entries(EXERCISE_ICONS),
    ...Object.entries(KIND_ICONS).map(([k, p]) => [`kind: ${k}`, p]),
  ])}`;
}

const rows = (n) => Math.ceil(n / COLUMNS);
const height = 32 + 2 * 40 + CELL_H * (rows(Object.keys(PICTOGRAMS).length) + rows(13)); // 13 original drawings
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'pictograms-'));
try {
  for (const scheme of ['light', 'dark']) {
    const html = join(tmp, `${scheme}.html`);
    writeFileSync(html, page(scheme));
    const png = join(outDir, `pictograms-${scheme}.png`);
    rmSync(png, { force: true });
    // Chrome sometimes exits non-zero while tearing down after it wrote the file, so judge by the file.
    const run = spawnSync(chrome, [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=${join(tmp, 'profile')}`,
      '--force-device-scale-factor=2',
      `--window-size=${32 + COLUMNS * CELL_W},${height}`,
      `--screenshot=${png}`,
      `file://${html}`,
    ]);
    if (!existsSync(png)) throw new Error(`Chrome wrote no ${png}:\n${run.error ?? run.stderr}`);
    console.log(png);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
