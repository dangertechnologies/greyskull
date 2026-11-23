import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const SOURCE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/dist/exercises.json`;
export const PICTOGRAM_KEYS = [
  'squat',
  'front-squat',
  'goblet-squat',
  'lunge',
  'split-squat',
  'pistol',
  'shrimp-squat',
  'step-up',
  'deadlift',
  'rdl',
  'hip-thrust',
  'nordic',
  'kb-swing',
  'bench',
  'incline-press',
  'overhead-press',
  'push-up',
  'pike-push-up',
  'handstand-push-up',
  'dip',
  'row',
  'inverted-row',
  'pull-up',
  'chin-up',
  'muscle-up',
  'lat-pulldown',
  'curl',
  'triceps-extension',
  'lateral-raise',
  'face-pull',
  'shrug',
  'calf-raise',
  'leg-extension',
  'leg-curl',
  'plank',
  'hollow-hold',
  'l-sit',
  'leg-raise',
  'ab-wheel',
  'bridge',
  'back-extension',
  'handstand',
  'front-lever',
  'back-lever',
  'planche',
  'support-hold',
  'dead-hang',
  'carry',
  'stretch',
  'cardio',
  'generic',
];
const categories = new Set([
  'strength',
  'powerlifting',
  'olympic weightlifting',
  'plyometrics',
  'stretching',
]);
export const EQUIPMENT = {
  barbell: 'barbell',
  'e-z curl bar': 'ez-bar',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  cable: 'cable',
  machine: 'machine',
  'body only': 'none',
  bands: 'bands',
  'foam roll': 'foam-roll',
  'exercise ball': 'exercise-ball',
  'medicine ball': 'medicine-ball',
  other: 'none',
};
const normal = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');
const muscle = (s) => s.replaceAll(' ', '-');
const rules = [
  [/pistol/i, 'pistol'],
  [/glute.ham|nordic/i, 'nordic'],
  [/front squat/i, 'front-squat'],
  [/goblet squat/i, 'goblet-squat'],
  [/split squat/i, 'split-squat'],
  [/squat|leg press|hack /i, 'squat'],
  [/lunge/i, 'lunge'],
  [/step.?up/i, 'step-up'],
  [/romanian|stiff.leg/i, 'rdl'],
  [/deadlift|good morning/i, 'deadlift'],
  [/hip thrust/i, 'hip-thrust'],
  [/swing/i, 'kb-swing'],
  [/incline.*press|incline.*bench/i, 'incline-press'],
  [/bench.*press|floor press|chest press|board press/i, 'bench'],
  [/push.?up/i, 'push-up'],
  [/dip/i, 'dip'],
  [/chin.?up/i, 'chin-up'],
  [/pull.?up/i, 'pull-up'],
  [/pulldown|pull.down/i, 'lat-pulldown'],
  [/row/i, 'row'],
  [/leg curl|hamstring curl/i, 'leg-curl'],
  [/curl/i, 'curl'],
  [/tricep|pushdown|skull/i, 'triceps-extension'],
  [/lateral|scaption|abduction/i, 'lateral-raise'],
  [/face pull/i, 'face-pull'],
  [/shrug/i, 'shrug'],
  [/calf|calves/i, 'calf-raise'],
  [/leg extension/i, 'leg-extension'],
  [/plank/i, 'plank'],
  [/leg raise|knee raise/i, 'leg-raise'],
  [/rollout|ab roller/i, 'ab-wheel'],
  [/bridge/i, 'bridge'],
  [/hyperextension|back extension/i, 'back-extension'],
  [/carry|walk/i, 'carry'],
  [/press|jerk|snatch|clean|raise|fly|flye|protraction|rotation/i, 'overhead-press'],
];
const familyRules = [
  [/\bpush[ -]*ups?\b/i, 'push-up'],
  [/\bplanks?\b/i, 'plank'],
  [/\bchin[ -]*ups?\b/i, 'chin-up'],
  [/\bpull[ -]*ups?\b/i, 'pull-up'],
  [/\bdips?\b/i, 'dip'],
  [/\blunges?\b/i, 'lunge'],
  [/\binverted.*rows?\b/i, 'inverted-row'],
  [/\brows?\b/i, 'row'],
];
export function pictogram(e) {
  const family = familyRules.find(([re]) => re.test(e.name))?.[1];
  if (family) return family;
  if (e.pattern === 'mobility') return 'stretch';
  return (
    rules.find(([re]) => re.test(e.name))?.[1] ??
    { core: 'hollow-hold', pull: 'row', push: 'push-up', squat: 'squat', hinge: 'deadlift', carry: 'carry' }[
      e.pattern
    ] ??
    'generic'
  );
}
export function pattern(e) {
  const n = e.name.toLowerCase();
  if (e.category === 'stretching') return 'mobility';
  if (/carry|farmer.*walk/.test(n)) return 'carry';
  if (/squat|lunge|step.up|leg press/.test(n)) return 'squat';
  if (/deadlift|good morning|swing|hip thrust|bridge/.test(n)) return 'hinge';
  if ((e.primaryMuscles ?? e.muscles ?? []).includes('abdominals')) return 'core';
  if (/press|push|dip|tricep|fly/.test(n)) return 'push';
  if (/row|pull|chin|curl|shrug/.test(n)) return 'pull';
  return e.force === 'push' ? 'push' : e.force === 'pull' ? 'pull' : 'skill';
}
export function mapExercise(s) {
  if (
    !s ||
    typeof s.id !== 'string' ||
    typeof s.name !== 'string' ||
    !Array.isArray(s.primaryMuscles) ||
    !Array.isArray(s.secondaryMuscles)
  )
    throw new Error('Invalid source entry');
  const kind =
    {
      barbell: 'barbell',
      'e-z curl bar': 'barbell',
      dumbbell: 'dumbbell',
      kettlebells: 'kettlebell',
      cable: 'machine',
      machine: 'machine',
    }[s.equipment] ?? 'bodyweight';
  const increment = { kg: ['barbell', 'bodyweight'].includes(kind) ? 2.5 : 2, lb: 5 };
  const e = {
    id: s.id.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase(),
    name: s.name,
    shortName: s.name.split(/\s+/).slice(0, 2).join(' '),
    abbr: s.name
      .replace(/[^a-zA-Z ]/g, '')
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 3)
      .toUpperCase(),
    kind,
    equipment: [EQUIPMENT[s.equipment] ?? 'none'],
    muscles: s.primaryMuscles.map(muscle),
    secondary: s.secondaryMuscles.map(muscle),
    pattern: pattern(s),
    level: s.level,
    increment,
    ...(['dumbbell', 'kettlebell', 'machine'].includes(kind) ? { step: { ...increment } } : {}),
    ...(s.equipment === 'e-z curl bar' ? { barKg: { kg: 10, lb: 25 } } : {}),
  };
  if (/bench/i.test(s.name) && !e.equipment.includes('bench')) e.equipment.push('bench');
  if (/pull.?up|chin.?up/i.test(s.name)) e.equipment = ['pull-up-bar'];
  if (/\bdips?\b/i.test(s.name) && s.equipment === 'body only')
    e.equipment = [/bench/i.test(s.name) ? 'bench' : 'dip-bars'];
  e.pictogram = pictogram(e);
  return e;
}
export function description(e) {
  const equipment = e.equipment
    .map((item) => (item === 'none' ? 'no equipment' : item.replaceAll('-', ' ')))
    .join(', ');
  const muscles = e.muscles.length
    ? e.muscles.map((item) => item.replaceAll('-', ' ')).join(', ')
    : 'primary muscles unspecified';
  return { description: `${e.name}: ${equipment}; works ${muscles}; ${e.level ?? 'level unspecified'}.` };
}
export const serialize = (v) => `${JSON.stringify(v, null, 2)}\n`;
export function buildCatalog(existing, source, calisthenics = {}, { maxBytes = Infinity } = {}) {
  const exercises = {};
  for (const e of Object.values(existing)) {
    const match = source.find((s) => normal(s.name) === normal(e.name));
    const mapped = match ? mapExercise(match) : null;
    const muscles =
      mapped?.muscles ??
      (/crunch/.test(e.id.toLowerCase())
        ? ['abdominals']
        : /squat|leg press/i.test(e.name)
          ? ['quadriceps']
          : /deadlift/i.test(e.name)
            ? ['hamstrings', 'glutes']
            : /row|chin|pulldown/i.test(e.name)
              ? ['lats']
              : /curl/i.test(e.name)
                ? ['biceps']
                : /calf/i.test(e.name)
                  ? ['calves']
                  : /bench|dip/i.test(e.name)
                    ? ['chest', 'triceps']
                    : ['shoulders']);
    const equipment =
      mapped?.equipment ??
      (e.id === 'CHINUPS'
        ? ['pull-up-bar']
        : e.id === 'DIPS'
          ? ['dip-bars']
          : [e.kind === 'bodyweight' ? 'none' : e.kind, ...(/bench/i.test(e.name) ? ['bench'] : [])]);
    const enriched = { ...e, equipment, muscles, pattern: pattern({ ...e, muscles }) };
    if (['CHINUPS', 'DIPS'].includes(e.id)) enriched.increment = { kg: 2.5, lb: 5 };
    enriched.pictogram = pictogram(enriched);
    exercises[e.id] = enriched;
  }
  const names = new Set(
    [...Object.values(existing), ...Object.values(calisthenics)].map((e) => normal(e.name)),
  );
  const descriptions = {};
  let imported = 0;
  for (const s of [...source].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (!categories.has(s.category) || names.has(normal(s.name))) continue;
    const e = mapExercise(s);
    if (Object.hasOwn(exercises, e.id)) continue;
    names.add(normal(e.name));
    descriptions[e.id] = description(e);
    exercises[e.id] = { ...e, ...descriptions[e.id] };
    imported++;
  }
  for (const e of Object.values(calisthenics))
    exercises[e.id] = {
      ...e,
      pictogram: PICTOGRAM_KEYS.includes(e.pictogram) ? e.pictogram : pictogram(e),
    };
  const sorted = Object.fromEntries(Object.entries(exercises).sort(([a], [b]) => a.localeCompare(b, 'en')));
  const prose = new Set(source.flatMap((s) => s.instructions ?? []));
  for (const e of Object.values(descriptions))
    if (prose.has(e.description)) throw new Error('Source instruction copied');
  const bytes = Buffer.byteLength(serialize(sorted)) + Buffer.byteLength(serialize(descriptions));
  if (bytes > maxBytes) throw new Error(`Catalog budget exceeded: ${bytes} > ${maxBytes}`);
  return {
    exercises: sorted,
    descriptions,
    imported,
    bytes,
    generic: Object.values(sorted).filter((e) => e.pictogram === 'generic').length,
  };
}
export async function main() {
  const root = new URL('../', import.meta.url);
  const cache = new URL(`.cache/free-exercise-db/${COMMIT}.json`, root);
  let raw;
  try {
    raw = await readFile(cache, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);
    raw = await response.text();
    JSON.parse(raw);
    await mkdir(new URL('.cache/free-exercise-db/', root), { recursive: true });
    await writeFile(cache, raw);
  }
  const source = JSON.parse(raw);
  const existing = JSON.parse(await readFile(new URL('src/exercises.json', root), 'utf8'));
  let calisthenics = {};
  try {
    calisthenics = JSON.parse(await readFile(new URL('src/catalog/calisthenics.json', root), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const result = buildCatalog(existing, source, calisthenics);
  await mkdir(new URL('src/catalog/', root), { recursive: true });
  for (const key of ['exercises', 'descriptions'])
    await writeFile(new URL(`src/catalog/${key}.json`, root), serialize(result[key]));
  await writeFile(
    new URL('src/catalog/CREDITS.md', root),
    `# Exercise catalog credits\n\nSource: https://github.com/yuhonas/free-exercise-db\n\nPinned commit: ${COMMIT}\n\nLicence: Unlicense (https://unlicense.org/).\n\nOnly facts were imported: names, equipment, muscles, level and movement metadata. Source instructions and images were not imported. Imported descriptions are factual sentences composed only from mapped fields; imported entries have no form cues. Existing app content is preserved.\n\nSelection: all eligible unique entries ordered by source id; calisthenics entries win id clashes. No numeric size budget was specified; the build function accepts an explicit maxBytes budget.\n`,
  );
  const fallbackNames = new Map();
  for (const e of Object.values(result.exercises)) {
    if (e.pictogram === 'generic') fallbackNames.set(e.name, (fallbackNames.get(e.name) ?? 0) + 1);
  }
  console.log('Most common generic names (up to 25; ties ordered by name):');
  for (const [name, count] of [...fallbackNames]
    .sort(([a, ac], [b, bc]) => bc - ac || a.localeCompare(b, 'en'))
    .slice(0, 25))
    console.log(`${count} × ${name}`);
  console.log(
    `${Object.keys(result.exercises).length} entries; ${result.imported} imported; ${(result.bytes / 1e6).toFixed(3)} MB; generic ${result.generic} (${((100 * result.generic) / Object.keys(result.exercises).length).toFixed(2)}%)`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
