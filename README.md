# openeventkit widgets

The widget layer for [next-event-site](https://github.com/fntechgit/next-event-site):
the legacy openstack event-site widgets (schedule, registration, my-tickets, …)
packaged so a modern React host can mount them without inheriting their era.
A pnpm workspace of two packages:

- **[`packages/widgets`](./packages/widgets)** (`@openeventkit/widgets`) — the
  **uicore isolation layer** and the hosting machinery: per-widget manifests +
  vendor styles, the framework-free kernel (`./core`), the React-19 mount layer
  (`./mount`, `./host`), and the per-widget runtime entries a host imports
  (`<widget>/web-component` · `<widget>/react`). A host's runtime dependency.
- **[`packages/web-components`](./packages/web-components)**
  (`@openeventkit/web-components`) — the web-component build: esbuild bundles
  each widget as a self-contained custom element on its own React 18.3.1, plus
  the shared `runtime/` chunks, the import map, and the footprint analyzer.
  Ships the `widgets-build` / `widgets-analyze` bins; a host's devDependency.

Hosts consume both as `link:`/git-ref deps until the packages publish to npm.

## Commands

```bash
pnpm install
pnpm test                   # vitest + web-components script tests + typecheck
pnpm build:wc               # runtime/ chunks + import-map.json + *.shared.js
pnpm build:wc:standalone    # *.standalone.js only
pnpm analyze:check          # footprint analyzer (CI guard)
pnpm assets                 # regenerate vendor CSS modules from installed dists
```

## Docs

- [`packages/widgets/README.md`](./packages/widgets/README.md) — the isolation layer: what lives where
- [`packages/widgets/WIDGET-MOUNTING.md`](./packages/widgets/WIDGET-MOUNTING.md) — the mount contract (manifests, composers, renderers, the visit lifecycle, the stability contract)
- [`packages/widgets/CONSTRAINTS.md`](./packages/widgets/CONSTRAINTS.md) — every widget-forced constraint, by root cause
- [`packages/widgets/UPSTREAM.md`](./packages/widgets/UPSTREAM.md) — the upstream fix backlog
- [`packages/web-components/README.md`](./packages/web-components/README.md) — the build: structure, variants, dependencies, analyzer
- [`packages/web-components/ISOLATION-STRATEGY.md`](./packages/web-components/ISOLATION-STRATEGY.md) — why the web components run their own React
- [`packages/web-components/RUNTIME-REQUIREMENTS.md`](./packages/web-components/RUNTIME-REQUIREMENTS.md) — per-widget build needs (declare → orchestrate → verify)
- [`packages/web-components/SHARED-MUI-RUNTIME.md`](./packages/web-components/SHARED-MUI-RUNTIME.md) — the served MUI surface
- [`docs/REACT18-RUNTIME.md`](./docs/REACT18-RUNTIME.md) — the web-component React runtime (createRoot, roots per connected span)
