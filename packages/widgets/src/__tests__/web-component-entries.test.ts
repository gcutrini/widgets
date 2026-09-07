import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A `<widget>/web-component` entry exists so the consumer's bundle carries
 * NOTHING of the widget's manifest graph — the widget's own bundle owns the
 * manifest. This walks each entry's static import graph and fails if it
 * reaches a manifest, vendor styles, or anything under src/lib (the
 * uicore-bound layer). It also keeps the exports map honest: every entry
 * file is exported, and every catalog widget exports a `/react` entry.
 */
const SRC = path.resolve(__dirname, '..');
const CATALOG = path.join(SRC, 'catalog');

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(SRC, '../package.json'), 'utf8'),
) as { exports: Record<string, string> };

const catalogDirs = fs
  .readdirSync(CATALOG, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const importSpecsOf = (file: string): string[] => {
  const src = fs.readFileSync(file, 'utf8');
  const specs: string[] = [];
  // Runtime imports only — `import type` vanishes at compile time.
  for (const m of src.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
    if (!m[1]) specs.push(m[2]);
  }
  for (const m of src.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) {
    specs.push(m[1]);
  }
  for (const m of src.matchAll(/^export\s+(type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/gm)) {
    if (!m[1]) specs.push(m[2]);
  }
  return specs;
};

const resolveRelative = (fromFile: string, spec: string): string | null => {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};

/** All package files statically reachable from `entry` (relative imports). */
const reachableFrom = (entry: string): string[] => {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    for (const spec of importSpecsOf(file)) {
      if (!spec.startsWith('.')) continue; // bare imports (react) checked separately
      const resolved = resolveRelative(file, spec);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...seen];
};

describe('web-component entries stay out of the manifest graph', () => {
  const entries = catalogDirs
    .map((name) => path.join(CATALOG, name, 'web-component.tsx'))
    .filter((p) => fs.existsSync(p));

  it('at least the shipped web-component widgets have entries', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries.map((e) => [path.relative(SRC, e), e]))(
    '%s reaches no manifest, vendor styles, or src/lib module',
    (_label, entry) => {
      const violations = reachableFrom(entry as string).filter((file) => {
        const rel = path.relative(SRC, file);
        return (
          /(^|\/)manifest\.(ts|tsx)$/.test(rel) ||
          rel.includes('vendor-styles') ||
          rel.startsWith('lib/')
        );
      });
      expect(violations.map((v) => path.relative(SRC, v))).toEqual([]);
    },
  );
});

describe('the runtime entries and the exports map agree', () => {
  it('every web-component.tsx is exported at ./<widget>/web-component', () => {
    for (const name of catalogDirs) {
      const hasEntry = fs.existsSync(path.join(CATALOG, name, 'web-component.tsx'));
      const exported = `./${name}/web-component` in pkg.exports;
      expect({ name, exported }).toEqual({ name, exported: hasEntry });
    }
  });

  it('every catalog widget exports a ./<widget>/react entry', () => {
    for (const name of catalogDirs) {
      expect(
        { name, react: `./${name}/react` in pkg.exports },
      ).toEqual({ name, react: true });
    }
  });
});
