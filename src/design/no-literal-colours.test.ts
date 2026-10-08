import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..', '..');
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

/** Files allowed to contain colour literals: the design tokens and data colours (plates). */
const ALLOWED = new Set(['src/design/tokens.ts', 'src/ui/PlateStack.tsx']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === 'node_modules' || name === '__tests__' ? [] : walk(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test('screens and components use theme colour roles, never literal colours', () => {
  const offenders = [...walk(join(root, 'app')), ...walk(join(root, 'src'))]
    .map((file) => relative(root, file))
    .filter((file) => !ALLOWED.has(file))
    .filter((file) =>
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .some((line) => LITERAL.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')),
    );
  expect(offenders).toEqual([]);
});
