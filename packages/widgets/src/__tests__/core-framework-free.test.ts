import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * src/core is the framework-free kernel: its files are bundled INTO the
 * React-17 island bundles, so they must never import React code, MUI,
 * uicore, or anything from the rest of this package. Only sibling files
 * and type-only react imports are allowed. This test is the boundary the
 * old separate widget-core package used to provide.
 */
const CORE = path.resolve(__dirname, '../core');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });

const importsOf = (file: string): { spec: string; typeOnly: boolean }[] => {
  const src = fs.readFileSync(file, 'utf8');
  const out: { spec: string; typeOnly: boolean }[] = [];
  for (const m of src.matchAll(/^import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/gm)) {
    out.push({ spec: m[2], typeOnly: Boolean(m[1]) });
  }
  for (const m of src.matchAll(/^import\s+['"]([^'"]+)['"]/gm)) {
    out.push({ spec: m[1], typeOnly: false });
  }
  for (const m of src.matchAll(/^export\s+(type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/gm)) {
    out.push({ spec: m[2], typeOnly: Boolean(m[1]) });
  }
  return out;
};

describe('core stays framework-free', () => {
  it('src/core exists', () => {
    expect(fs.existsSync(CORE)).toBe(true);
  });

  it('core files import only siblings and react types', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(CORE)) {
      for (const { spec, typeOnly } of importsOf(file)) {
        if (spec.startsWith('.')) continue; // siblings within core
        if (spec === 'react' && typeOnly) continue; // types vanish at compile time
        violations.push(`${path.relative(CORE, file)} imports '${spec}'${typeOnly ? ' (type)' : ''}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
