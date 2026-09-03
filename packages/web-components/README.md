# @openeventkit/web-components

Legacy widgets packaged as self-contained **React-17 web components**, built by
esbuild into static assets under `public/web-components/`. This is a **separate
build** from the app's Next/React-19 compile (own React 17; a pnpm workspace
member with its own `package.json`, built with `pnpm --filter`), so the
widgets' React 17 never enters the app's module graph.

See `packages/web-components/ISOLATION-STRATEGY.md` for the full strategy, POC evidence, and the
per-widget plan.

## Structure — and where each part ultimately lives

```
scripts/       Node-side tooling; never bundled
  build.mjs                 orchestrator: generates each widget's entry as an
                            esbuild stdin module from its shared manifest;
                            emits the runtime/ chunks + import-map.json + per-widget
                            shared (default) or standalone (--standalone)
  analyze-widgets.mjs       report + CI guard (--check / --update-baseline)
  plugins.mjs               the esbuild resolution plugins + alias tables
  runtime-entries.mjs       runtime-entry generation: export-shape probe,
                            entry templates, chunk naming, import map
  footprint.mjs             dependency-footprint derivation library
  policy.mjs                the judgment data humans edit: WIDGETS, the
                            served surfaces, import overrides, node-builtin
                            lists, the dep-classification tables
  analyze-widgets.baseline.json   accepted analyzer exceptions

src/           everything below is bundled into the island bundles
  element/     the custom-element machinery
    define-web-component.js   custom element on injected React 17; delegates
                              shadow setup to widget-core createWidgetShadow
    resolve-component.js      picks the component out of a webpack-UMD dist
  shims/       esbuild inject targets, referenced only by build.mjs
    import-meta-url-shim.js          (standalone IIFE only; ESM has it native)
```

The shared runtime itself has no committed source: the build generates one ES
module per served bare specifier (react, react-dom, jsx-runtime, the exposed
uicore paths, the MUI surface, the i18n seed) into `runtime/`, with esbuild
code-splitting guaranteeing a single instance of every stateful internal, and
writes `import-map.json` mapping each specifier to its chunk. The HOST inlines
that map in its document before any widget module loads
(`src/components/widget/WidgetImportMap.tsx` in the app).

The bundled `src/` imports `@openeventkit/widgets` (manifests, `uicore-host`,
the `compat/uicore-*` modules) and `@openeventkit/widget-core`
(`createWidgetShadow`, the manifest type) as `workspace:*` dependencies by bare
specifier.

**Target topology (three homes):**

| Piece | Eventual home |
|---|---|
| `src/*` (element/shims) | **a published shared kit package** — extracted from this `@openeventkit/web-components` package |
| each widget's entry (generated in `scripts/build.mjs`) + its CSS | **each widget's own repo** (it owns its dep graph + export shape, so `resolve-component` isn't even needed there) |
| the app-side host + per-widget data composition | **the consuming app** (`src/components/widget/renderers/`, `src/widgets/<widget>/`) |

Today all build-side roles live here while we prototype; the `src/` vs
entry split makes those moves mechanical.

## Distribution variants (implementor picks)

- **shared** — `‹name›.shared.js`: an ES module whose shared imports (react,
  react-dom, jsx-runtime, the exposed uicore paths, the served MUI surface)
  stay bare and resolve through the host-inlined import map to the `runtime/`
  chunks — the browser walks the module graph; there is no load ordering.
  This is the variant the app loads.
- **standalone** — `‹name›.standalone.js`, React 17 bundled in. Drop-in for a
  host that loads no runtime chunks. Opt-in build.

## Build

From the repo root (`pnpm install` at the root installs this package too):

```
pnpm build:wc               # default: runtime/ chunks + import-map.json + *.shared.js
pnpm build:wc:standalone    # *.standalone.js only
```

Or inside the package: `pnpm build` / `pnpm build:standalone`
(`node scripts/build.mjs` / `node scripts/build.mjs --standalone`). The root `prebuild`
script runs the default build.

Output goes wherever `--out` says (the root scripts pass `public/web-components/`, gitignored; the package default is its own `dist/`) — rebuilt on demand.
`--public-path` sets the URL path the import map bakes into its chunk URLs
(default `/web-components/` → chunks at `/web-components/runtime/…`) — a host
serving the output from a different path passes its own.

## Dependencies — why each is declared

The `dependencies` list plays four roles; when pruning, know which one an entry
serves:

1. **The pinned React-17 runtime** — exact `react`/`react-dom` 17.0.2 plus the
   full top-level `@mui/*` v5 set and `@emotion/*`, so pnpm materializes the
   coherent React-17-peered MUI 5 tree in THIS package's `node_modules` (the
   `muiReact17Plugin` re-resolves from here; see SHARED-MUI-RUNTIME.md).
   `@emotion/styled` is declared even though no widget dist imports it yet:
   undeclared, a future import would resolve up to the root's React-19-peered
   copy.
2. **Browser polyfills for Node built-ins** — provided by
   `esbuild-plugin-polyfill-node` (configured from the policy builtin lists in
   plugins.mjs); no polyfill packages are declared here.
3. **uicore 4.x peers** — the long tail (`history`, `superagent`, `urijs`,
   `validator`, `react-select`, …): uicore's dist files resolve these from this
   package, whether or not a widget bundles the module that uses them.
4. **Build helpers** — `use-sync-external-store` (the react runtime entry's
   back-fill), `esbuild` (dev).

## Analyzer

`pnpm analyze` (`scripts/analyze-widgets.mjs`) reports each widget's real dependency
footprint against its manifest `runtimeNeeds`; `pnpm analyze:check` fails on
drift. Accepted exceptions live in `analyze-widgets.baseline.json`:
`acceptedUnknown`, `acceptedBarrels`, and `acceptedMuiMissing` (MUI barrels a
widget dist still imports and bundles itself; see `packages/widgets/UPSTREAM.md`
entry 14).
