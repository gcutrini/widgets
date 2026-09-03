/**
 * Shared-runtime entry generation — the pure mechanics behind the runtime/
 * chunks: probe each served module's export shape, generate its ESM re-export
 * entry, name its chunk, and compose the import map. Writes no files and runs
 * no esbuild — build.mjs owns the pass; this module owns what the entries say.
 *
 * CJS sources (react, react-dom, uicore, the compat modules) get generated
 * re-export entries with STATIC named exports — real ESM modules need static
 * names, and CJS modules can't provide them, so the build enumerates each
 * module's keys in Node first (probeModules). ESM sources (the MUI 5
 * packages) re-export directly.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Bare-specifier chunk filename: react-dom → react-dom.js, @mui/material/Box → mui-material-Box.js */
export const chunkName = (spec) =>
  spec.replace(/^@/, '').replace(/[/]/g, '-').replace(/[^a-zA-Z0-9._-]/g, '_');

const isIdent = (k) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) && k !== 'default';

/**
 * Named-export keys per CJS module, by requiring each in Node. CSS/asset
 * requires inside uicore lib files are no-opped for the probe; our own TS
 * compat modules cannot be required in Node, so their (stable, ours) key sets
 * are declared here. Keys must track UICORE_IMPORT_OVERRIDES values in
 * policy.mjs — the probe receives import specifiers, not slots.
 */
const KNOWN_TS_SHAPES = {
  '@openeventkit/widgets/compat/uicore-i18n': { named: [], hasDefault: false, isEsm: true },
  '@openeventkit/widgets/compat/uicore-ajaxloader': { named: [], hasDefault: true, isEsm: true },
};

export function probeModules(specs) {
  const Module = require('module').Module ?? require('module');
  const noopExts = ['.css', '.scss', '.svg', '.png', '.jpg', '.gif', '.woff', '.woff2', '.ttf', '.eot', '.less'];
  const saved = {};
  for (const ext of noopExts) {
    saved[ext] = Module._extensions[ext];
    Module._extensions[ext] = (mod) => { mod.exports = {}; };
  }
  const shapes = {};
  try {
    for (const spec of specs) {
      if (spec in KNOWN_TS_SHAPES) {
        shapes[spec] = KNOWN_TS_SHAPES[spec];
        continue;
      }
      // eslint-disable-next-line import/no-dynamic-require
      const mod = require(spec);
      const isEsm = mod != null && mod[Symbol.toStringTag] === 'Module';
      const named = Object.keys(mod).filter(isIdent);
      shapes[spec] = {
        named,
        // CJS: default is the whole module.exports (esbuild interop). ESM: only
        // when the module actually has one.
        hasDefault: !isEsm || 'default' in mod,
        isEsm,
      };
    }
  } finally {
    for (const ext of noopExts) {
      if (saved[ext]) Module._extensions[ext] = saved[ext];
      else delete Module._extensions[ext];
    }
  }
  return shapes;
}

/**
 * Generated ESM entry for one shared specifier. Shape-agnostic on purpose:
 * dual-package modules resolve to their CJS build under Node's probe but to
 * their browser ESM build under esbuild, so default-ness cannot be trusted
 * statically. `__ns.default ?? __ns` picks the right object at runtime for
 * both; named exports come from the probed key set (a missing key surfaces
 * loudly as a widget-build error, never a silent {}).
 */
export function entrySource(spec, importSpec, shape) {
  if (shape.named.length === 0 && !shape.hasDefault) {
    // Pure side-effect module (the i18n seed).
    return `import ${JSON.stringify(importSpec)};\nexport {};\n`;
  }
  const named = [...shape.named];
  const lines = [
    `import * as __ns from ${JSON.stringify(importSpec)};`,
    'const __m = __ns.default !== undefined ? __ns.default : __ns;',
    // Named values come from the NAMESPACE when it carries them (browser-ESM
    // modules with default + named, e.g. @mui/material/<Component> and its
    // *Classes helpers) and fall back to the default object (CJS, where the
    // whole exports object IS the default). Static-shape guessing is
    // impossible here: Node's probe sees the CJS build of dual-package
    // modules while esbuild bundles the browser ESM build.
    'const __pick = (k) => (__ns[k] !== undefined ? __ns[k] : __m == null ? undefined : __m[k]);',
  ];
  if (spec === 'react') {
    // Back-fill the React 18 APIs that React-18-era deps bundled inside the
    // widgets call unguarded on this React-17 runtime:
    // - useSyncExternalStore: react-redux v8 imports use-sync-external-store/
    //   with-selector — the non-shim entry that calls it off React directly —
    //   so redux-connected widgets (e.g. schedule-full) crash at mount.
    // - useId: react-content-loader v7 (reg-lite's skeletons) calls
    //   React.useId() directly. The islands never server-render, so a counter
    //   id held stable per component via useRef is fully correct.
    lines.unshift("import { useSyncExternalStore as __uSES } from 'use-sync-external-store/shim';");
    lines.push('if (!__m.useSyncExternalStore) __m.useSyncExternalStore = __uSES;');
    lines.push('let __nextId = 0;');
    lines.push('const __useId = () => { const r = __m.useRef(); if (r.current === undefined) r.current = ":wc-r" + (__nextId++).toString(36) + ":"; return r.current; };');
    lines.push('if (!__m.useId) __m.useId = __useId;');
    if (!named.includes('useSyncExternalStore')) named.push('useSyncExternalStore');
    if (!named.includes('useId')) named.push('useId');
  }
  for (const k of named) lines.push(`export const ${k} = __pick(${JSON.stringify(k)});`);
  lines.push('export default __m;');
  return lines.join('\n') + '\n';
}

/**
 * The import map: every served bare specifier → its chunk URL, resolved
 * against the path the host serves the build output from.
 */
export function importMapFor(specs, prefix) {
  const imports = {};
  // chunkName's flattening is lossy ('@a/b-c' and '@a/b/c' collide) and the
  // specifier list is partly derived — refuse a silent chunk overwrite.
  const bySpec = new Map();
  for (const spec of specs) {
    const name = chunkName(spec);
    const prior = bySpec.get(name);
    if (prior !== undefined && prior !== spec) {
      throw new Error(`chunk name collision: "${prior}" and "${spec}" both flatten to ${name}.js`);
    }
    bySpec.set(name, spec);
    imports[spec] = `${prefix}${name}.js`;
  }
  return { imports };
}
