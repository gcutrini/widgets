# @openeventkit/widgets

The **uicore isolation layer** — the only place the legacy openstack event-site
widget dists and their dep tree (`openstack-uicore-foundation`, `redux`,
`react-bootstrap`, …) are allowed to live, keeping them out of the host's
`package.json`. This package holds the *uicore-bound* part of each widget; the
host holds the integration glue (data, auth, realtime, routing). It also
carries the hosting machinery itself — the framework-free kernel at
`src/core/` (`./core` subpaths) and the React-19 mount layer at `src/mount/`
(`./mount`, `./host`) — so a host depends only on `@openeventkit/widgets` plus
the `@openeventkit/web-components` build tool. See
[`WIDGET-MOUNTING.md`](./WIDGET-MOUNTING.md) for how a widget mounts.

## How a widget is split

A hosted widget spans two places, divided by what each part is allowed to depend on:

- **The uicore-bound part — here (this package):** per widget, `manifest`
  (loads the widget dist + declares its shadow sheets/bridges) and `vendor-styles`
  (the widget's CSS). Plus the shared uicore machinery under `src/lib/` —
  `uicore-host` (hands uicore the host's config and auth seams), the
  `compat/uicore-*` modules, and the bundle-consumed React contexts
  (`context/`).
- **The integration glue — the host (its `src/widgets/<w>/`):**
  `index.tsx` (a Server Component that fetches host data), `compose.ts` (binds the
  host's live auth / realtime state), `Client.tsx`, `types.ts`, `derive.ts`,
  `use<Widget>Callbacks.ts`. These import the host's own modules freely — they
  *are* host code — and reach back into this package only for the manifest.

Because the integration glue lives in the host, the uicore-bound modules import
**nothing host-side**: anything they need from the host crosses through a core
**port** (session presence and logout via HostAuth, the API / IDP / time-service
settings via HostConfig, the auth-error event), never a direct host import.

## What lives here

`src/` holds the widgets and the three shared layers they're built from.
The package is **subpath-only** — no root export, no `main`/`types`; every
surface is a named entry in the exports map.

- `src/<widget>/` — `manifest.ts(x)` + `vendor-styles.ts` per widget, plus any
  widget-specific bits (e.g. `schedule-lite/transition-group.ts`,
  `schedule-full/{deep-link,hide-widget-toolbar}.ts`). `.tsx` when the manifest
  needs JSX, e.g. a `wrapTree` that renders an `EmotionShadowProvider`
  (schedule-full, registration).
- `src/core/` (`./core`, `./core/*`) — the framework-free kernel: bundled into
  the React-17 islands as well as imported by the host, so a test
  (`src/__tests__/core-framework-free.test.ts`) enforces that its files import
  nothing beyond core siblings and react types. It holds `createWidgetShadow`,
  the `WidgetManifest` type (incl. `WidgetBridge`), `webComponentTag`, the
  host ports (`host-auth`, `host-config`), and the DOM event contracts
  (`widget-auth-error`, `widget-notify`, `widget-error`).
- `src/mount/` (`./mount`, `./mount/renderers/shadow-react`,
  `./mount/renderers/web-component`, `./mount/compat/*`, `./host`)
  — the React-19 host mounting layer: `<Widget>`, the `WidgetRenderer`
  interface + registry, the `WidgetComposition` contract, the two generic
  renderer factories, `mutation-safe-props`, the React-19 compat shims, and
  `configureWidgetHost` (exported as `./host` — see "The host's setup call").
- `src/lib/` — everything not tied to one widget (by coupling, not consumer count: a generic module stays here even while only one widget uses it):
  - `uicore-host.ts` — `configureUicore()`: reads the HostConfig and HostAuth ports
    and calls uicore's `setConfig`, `setAccessTokenResolver` and `setAuthHandlers`.
    The resolver returns the `SESSION_PRESENT` placeholder while a session exists
    and throws only on a certain signed-out; `initLogOut` delegates to
    `HostAuth.logout`; 401/403 raise the `widget-auth-error` event.
    `configureWidgetHost` calls it after filling the ports; the web-component
    runtime calls it on its own uicore copy.
  - `compat/` — `uicore-swal` (the web-component build aliases `sweetalert2` to
    it; forwards to the widget-notify port), `uicore-ajaxloader` (the host-styled
    `AjaxLoader` the shared runtime serves), `uicore-i18n`.
  - `bridges/` — `WidgetBridge` implementations for shadow-hostile legacy
    libraries (emotion mirror, click-outside retarget, tooltip, scoped portal
    CSS); manifests declare them, `createWidgetShadow` runs them.
  - `context/` — `shadow-root-context` (`ShadowRootContext` + `useShadowRoot`),
    `EmotionShadowProvider`, `MuiThemeBridge` (a `wrapTree` React provider —
    not a `WidgetBridge`, despite the name).
  - `styles/` — shared hand-authored CSS adopted into the shadow root.
  - `vendor-css/` — generated vendor CSS modules (see “Vendor CSS and asset
    binaries” below).
  - `webpack-compat.ts` — the webpack compat the host applies via `applyWidgetCompat`:
    one `openstack-uicore-foundation` alias (every import resolves to this package's
    uicore copy, so the setters reach the instance the widgets use) plus the
    react-select `findDOMNode` rule.
- [`CONSTRAINTS.md`](./CONSTRAINTS.md) — the durable inventory of every widget-forced
  constraint. Read it before touching a widget module.

## Vendor CSS and asset binaries

The legacy dists ship stylesheets the shadow root cannot reach through
`document.head`, so this package generates them as typed modules and owns the
binaries they reference:

- `scripts/generate-assets.mjs` (this package's `assets` npm script; `pnpm
  assets` at the workspace root) reads each vendor stylesheet from the
  installed dists, splits out `@font-face`, and emits
  `src/lib/vendor-css/<name>.ts` (`export const sheet: VendorSheet`). Outputs
  are committed, so a fresh clone typechecks without running it. Regeneration
  happens only here — hosts never run this script.
- Font and image binaries land in `assets/` (committed). Generated url()
  references carry the `__WIDGET_ASSETS__` placeholder; `createWidgetShadow`
  substitutes it with `HostConfig.assetBaseUrl` at use time.
- A host serves `assets/` wherever it wants and says where in
  `HostConfig.assetBaseUrl`. Empty (the default) means the site root: the
  reference host copies this package's pre-built `assets/` into its `public/`
  (its `scripts/sync-widget-assets.mjs`, run by its `copy:widget-assets`
  script at `predev` / `prebuild` — a copy, never a regeneration) and leaves
  the base empty.

## The layered architecture

Dependencies flow one way; uicore stays contained; the esbuild bundle pulls only
framework-free code:

```
HOST (separate repo)           pages, DAL, and one configureWidgetHost() call
   │  fills ports              (renderers + HostAuth + HostConfig, via ./host)
   ▼
HOST src/widgets/<w>/          index / Client / compose / types  (host integration glue)
   ▼ imports (host → widgets)
@openeventkit/widgets          ← THIS PACKAGE
   src/<widget>/    manifest + vendor-styles (uicore-bound, per widget)
   src/lib/         uicore-host, compat/*, bridges/, context/, vendor-css/
   src/mount/  ──▶  src/core/
     <Widget>, WidgetRenderer +   framework-free kernel: createWidgetShadow,
     registry, React-19 shims,    the WidgetManifest type (incl. WidgetBridge),
     mutation-safe-props,         the ports (host-auth, host-config), and the
     configureWidgetHost          widget-auth-error / -notify / -error events
      ▲
@openeventkit/web-components (esbuild) — own React 17; imports only ./core/*
and the uicore-bound subpaths, never ./mount
```

## The mount contract (brief — full detail in WIDGET-MOUNTING.md)

- **`manifest`** (here) — which dist to `load`, the `vendorSheets` / `inlineStyles`
  to adopt, the `bridges` to run, the shadow host `elementTag` / `elementAttrs`.
- **`compose`** (in the host) — a hook binding the widget's live inputs (realtime
  store, auth-safe profile, bound callbacks, host vars) into a `WidgetComposition`.
- **`<Widget manifest composition renderAs>`** (`@openeventkit/widgets/mount`) —
  resolves `renderAs` (`'react-component'` | `'web-component'`) via the renderer
  registry `configureWidgetHost` fills at startup, and mounts it. The host
  builds its two renderers from the generic factories
  (`./mount/renderers/shadow-react`, `./mount/renderers/web-component`),
  injecting only its own pieces (lazy loading, error boundary, bundle base
  path):
  - **`reactComponent`** — runs the widget on the host's React 19 in a
    `createWidgetShadow` (prop mutation-safety, React-19 compat shims,
    ShadowRootContext and the uicore i18n seed provided by the renderer). The
    default for every widget.
  - **`webComponent`** — runs it on its own bundled React 17 as a self-contained
    custom element built by `@openeventkit/web-components`.

## The host's setup call

`configureWidgetHost({ config, auth, renderers })` from
`@openeventkit/widgets/host` is the host's single setup call, run once at
startup (module eval, before any widget renders). It fills the HostConfig and
HostAuth ports, registers the renderers, and calls `configureUicore()` — and it
owns that ordering (uicore reads the config port eagerly), so no host has to
know about it. It is deliberately not on the `./mount` barrel: it pulls uicore
through `uicore-host`, and the barrel is imported by every widget client graph.

Legacy widgets mount their own inner Redux `<Provider>` before their selectors
fire, so the host renders none (see `CONSTRAINTS.md` RC-R).

## Writing a new widget

- **Here (uicore-bound):** add `src/<widget>/manifest.ts` (dist `load`,
  `vendorSheets`, `bridges`, `elementTag`) + `src/<widget>/vendor-styles.ts`;
  export `./<widget>/manifest` from `package.json`.
- **In the host (its `src/widgets/<widget>/`):** `index.tsx` (fetch + derive + render
  `<Client>`), `compose.ts` (`use<Widget>Composition` → `{ props }`),
  `Client.tsx` (`<Widget manifest composition renderAs>`), `types.ts`, and any
  `derive.ts` / `use<Widget>Callbacks.ts`.

## Trade-offs we still live with

See [`CONSTRAINTS.md`](./CONSTRAINTS.md) for the full inventory. In short: the widgets
are React-16-era bundled CJS artifacts we can't rebuild ourselves, so the contract
is an accommodation, not a solution. Every entry explains why the machinery does
what it does, and which upstream fix would let us delete it.

## Related docs

- [`WIDGET-MOUNTING.md`](./WIDGET-MOUNTING.md) — the mounting contract
- [`CONSTRAINTS.md`](./CONSTRAINTS.md) — widget-integration trade-offs
- [`ISOLATION-STRATEGY.md`](../web-components/ISOLATION-STRATEGY.md) — the web-component path and its trade-offs
