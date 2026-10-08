/**
 * The widget layouts are compiled to strings (babel 'widget' directive) and evaluated by the extension with a
 * fixed set of globals. Evaluate them here the same way, with stand-in components, to catch references to
 * anything outside that set and to check what ends up on screen.
 */
jest.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: unknown) => ({ name, layout }),
  createLiveActivity: (name: string, layout: unknown) => ({ name, layout }),
}));

import { nextWorkoutWidget, restActivity } from './definitions';

type Node = { type: string; props: Record<string, unknown> };
const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
const components = Object.fromEntries(['VStack', 'HStack', 'Text'].map((n) => [n, n]));
const modifiers = Object.fromEntries(
  ['font', 'foregroundStyle', 'frame', 'monospacedDigit', 'padding'].map((n) => [
    n,
    (a?: unknown) => ({ n, a }),
  ]),
);

function evaluate(compiled: unknown, ...args: unknown[]) {
  expect(typeof compiled).toBe('string'); // the 'widget' directive turned the function into source text
  const scope = { ...components, ...modifiers, jsx, jsxs: jsx, _jsx: jsx, _jsxs: jsx };
  const names = Object.keys(scope);
  const fn = new Function(...names, `return (${compiled as string});`)(...Object.values(scope));
  return fn(...args);
}

const texts = (node: unknown): string[] => {
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(texts);
  if (node && typeof node === 'object' && 'props' in node) return texts((node as Node).props.children);
  return [];
};

test('next workout widget renders title, week and lifts', () => {
  const out = evaluate((nextWorkoutWidget as unknown as { layout: unknown }).layout, {
    title: 'Workout A',
    subtitle: 'Week 2',
    lines: ['Squat 62.5 kg', 'Bench 40 kg'],
    inProgress: false,
    ready: true,
  });
  expect(texts(out)).toEqual(['WEEK 2', 'Workout A', 'Squat 62.5 kg', 'Bench 40 kg']);
});

test('in-progress state replaces the week label', () => {
  const out = evaluate((nextWorkoutWidget as unknown as { layout: unknown }).layout, {
    title: 'A',
    subtitle: 'Week 2',
    lines: [],
    inProgress: true,
    ready: true,
  });
  expect(texts(out)[0]).toBe('IN PROGRESS');
});

test('rest live activity defines every Dynamic Island region around a native timer', () => {
  const layout = evaluate(
    (restActivity as unknown as { layout: unknown }).layout,
    { label: 'Squat · set 1 of 2', startsAt: 1000, endsAt: 91000 },
    { colorScheme: 'dark' },
  ) as Record<string, Node>;
  for (const key of [
    'banner',
    'compactLeading',
    'compactTrailing',
    'minimal',
    'expandedLeading',
    'expandedTrailing',
    'expandedBottom',
  ]) {
    expect(layout[key]).toBeDefined();
  }
  const timer = layout.compactTrailing;
  expect(timer.type).toBe('Text');
  const range = timer.props.timerInterval as { lower: Date; upper: Date };
  expect(range.lower.getTime()).toBe(1000);
  expect(range.upper.getTime()).toBe(91000);
  expect(timer.props.countsDown).toBe(true);
  expect(texts(layout.banner)).toContain('Squat · set 1 of 2');
});
