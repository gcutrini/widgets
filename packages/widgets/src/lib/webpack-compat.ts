import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Webpack build-time compatibility the widget package needs from its host.
 *
 * Two things only the host's Next webpack can do for the legacy widget bundles
 * (this package ships raw TypeScript the host transpiles; it has no build of
 * its own): resolve every `openstack-uicore-foundation` import to THIS
 * package's copy, and give react-select@2 a `findDOMNode` (dropped in React
 * 19). The host wires both in one call from its `next.config.ts`:
 *
 *   import { applyWidgetCompat } from '@openeventkit/widgets/webpack-compat';
 *   webpack: (config) => { applyWidgetCompat(config); ... }
 *
 * Webpack-only: Turbopack ignores `next.config.webpack()`, and its
 * `resolveAlias` is a global specifier map with no per-module scoping — so the
 * scoped react-select `react-dom` shim below can't be expressed there (a
 * global alias would recurse through the shim's own react-dom import). The
 * runtime patch in @openeventkit/widget-mount/compat/find-dom-node is
 * bundler-agnostic and still covers widgets that read `ReactDOM.findDOMNode`
 * off the namespace.
 */

/**
 * uicore takes its config, token source and auth handlers through setters on
 * one module instance (see uicore-host). A widget dist that resolves a second
 * uicore copy (a `link:`ed package with its own node_modules, a nested peer
 * variant) would get an unconfigured one, so every `openstack-uicore-foundation`
 * import in the host graph is pointed at the copy this package resolves.
 */
export const UICORE_DIR = path.dirname(
  createRequire(import.meta.url).resolve('openstack-uicore-foundation/package.json'),
);

/**
 * Stateful singleton families the transpiled kit shares with the host UI:
 * MUI's theme/context tree, emotion's cache/theming entry points, and
 * scheduler. In the monorepo one store serves both graphs and these aliases
 * are no-ops; when this package is `link:`ed from its own repo, its imports
 * would otherwise resolve that repo's physical copies — two MUI/emotion
 * runtimes with split contexts in one page (verified via a webpack
 * module-graph probe). Ownership differs from uicore: MUI/emotion/scheduler
 * are the HOST's UI stack, so each family is pinned to the copy the host
 * resolves (uicore stays kit-owned — it is this package's domain). Anchoring
 * host-side also keeps the host's own MUI untouched when this package is
 * linked from a repo whose store materialized different peer variants.
 * Deliberately absent: the
 * low-level @emotion helpers (hash/memoize/unitless/…) — react-select@2's
 * bundled emotion 9 nests 0.6.x majors of those, which must keep resolving
 * their own versions; they collapse to one copy per major once the entry
 * points above are unified.
 */
/**
 * react-select@2 (pulled in by uicore) statically imports `findDOMNode`. This
 * rule points its `react-dom` at a shim that re-exports react-dom + the impl,
 * scoped to react-select's own files only so nothing else is affected.
 */
export const REACT_SELECT_REACT_DOM_SHIM =
  '@openeventkit/widgets/mount/compat/react-dom-with-find-dom-node';

export const REACT_SELECT_FINDDOMNODE_RULE = {
  test: /[/\\]\.pnpm[/\\]react-select@2[^/\\]*[/\\]/,
  resolve: { alias: { 'react-dom$': REACT_SELECT_REACT_DOM_SHIM } },
};

/** Apply all widget webpack compat to a Next/webpack config in place. */
export function applyWidgetCompat(config: {
  resolve: { alias: Record<string, unknown> };
  module?: { rules?: unknown[] };
}): void {
  // Host-anchored resolution: webpack configs run with cwd at the host root,
  // so this resolves the HOST's copies even when this file executes from a
  // linked kit repo. Package dirs are derived from the resolved ENTRY file
  // (sliced at its node_modules/<pkg>/ segment) — probing pkg/package.json
  // breaks on exports maps that do not expose it (e.g. @emotion/cache).
  const hostRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const pkgDirFromEntry = (spec: string, entry: string) => {
    const marker = `node_modules${path.sep}`;
    const idx = entry.lastIndexOf(marker);
    return path.join(entry.slice(0, idx + marker.length), spec);
  };
  const dirOf = (spec: string) => pkgDirFromEntry(spec, hostRequire.resolve(spec));
  const fromTree = (baseDir: string, pkg: string) =>
    pkgDirFromEntry(pkg, createRequire(path.join(baseDir, 'package.json')).resolve(pkg));

  config.resolve.alias['openstack-uicore-foundation'] = UICORE_DIR;

  // Entry points resolve from the host; each family member resolves through
  // its ACTUAL parent's tree (material → system → styled-engine/…), so the
  // whole set is one coherent physical installation. A generic walk from
  // material would fall through pnpm's .pnpm/node_modules fallback and can
  // grab an unrelated peer variant (observed: React-17 styled-engine 5.18
  // beside material 9.4 → internal_mutateStyles crash).
  const muiDir = dirOf('@mui/material');
  const systemDir = fromTree(muiDir, '@mui/system');
  config.resolve.alias['@mui/material'] = muiDir;
  config.resolve.alias['@mui/icons-material'] = dirOf('@mui/icons-material');
  config.resolve.alias['@mui/system'] = systemDir;
  config.resolve.alias['@mui/styled-engine'] = fromTree(systemDir, '@mui/styled-engine');
  config.resolve.alias['@mui/private-theming'] = fromTree(systemDir, '@mui/private-theming');
  config.resolve.alias['@mui/utils'] = fromTree(systemDir, '@mui/utils');
  const emotionReactDir = dirOf('@emotion/react');
  config.resolve.alias['@emotion/react'] = emotionReactDir;
  // cache is @emotion/react's dep — hosts rarely declare it directly.
  config.resolve.alias['@emotion/cache'] = fromTree(emotionReactDir, '@emotion/cache');
  config.resolve.alias['@emotion/styled'] = fromTree(muiDir, '@emotion/styled');
  config.resolve.alias['scheduler'] = fromTree(dirOf('react-dom'), 'scheduler');

  // Guarded: unit tests call this with a resolve-only config (no `module`).
  config.module?.rules?.push(REACT_SELECT_FINDDOMNODE_RULE);
}
