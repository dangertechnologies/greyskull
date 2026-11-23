import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

/**
 * `key in object` also finds what every object inherits ("constructor", "toString", "__proto__"), so on a plain
 * object keyed by an id from a file, a deep link or a model it accepts names that are not there. Use
 * `Object.hasOwn(map, key)` or `own(map, key)` (src/domain/own.ts) instead.
 *
 * Reviewed sites that are safe stay in this list, each with the reason.
 */
const ALLOWED: Record<string, string> = {
  // Narrowing the shape of objects returned by the native Health Connect module; the keys are literals.
  'src/health/platform.ts': 'native permission objects, literal keys',
};

const root = path.resolve(__dirname, '../../..');
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : files(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });

test('no membership operator `in` outside the reviewed list', () => {
  const found: string[] = [];
  for (const file of [...files(path.join(root, 'src')), ...files(path.join(root, 'app'))]) {
    const rel = path.relative(root, file);
    if (Object.hasOwn(ALLOWED, rel)) continue;
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (n: ts.Node) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.InKeyword) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        found.push(`${rel}:${line + 1}: ${n.getText().slice(0, 80)}`);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  expect(found).toEqual([]);
});
