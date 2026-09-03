# @openeventkit/widgets

The **uicore isolation layer** — the only place the legacy openstack event-site
widget dists and their dep tree (`openstack-uicore-foundation`, `redux`,
`react-bootstrap`, …) are allowed to live, keeping them out of the app's root
`package.json`. This package holds the *uicore-bound* part of each widget; the
app holds the integration glue (data, auth, realtime, routing). See
[`WIDGET-MOUNTING.md`](./WIDGET-MOUNTING.md) for how a widget mounts.

## How a widget is split

A hosted widget spans two places, divided by what each part is allowed to depend on:

- **The uicore-bound part — here (`packages/widgets`):** per widget, `manifest`
  (loads the widget dist + declares its shadow sheets/bridges) and `vendor-styles`
  (the widget's CSS). Plus the shared uicore machinery under `kit/` — `uicore-host`
  (hands uicore the host's config and auth seams), the `compat/uicore-*` modules,
  `ClockProvider`, and the bundle-consumed
  React contexts (`context/`).
- **The integration glue — the app (`src/widgets/<w>/`):** `index.tsx` (a Server
  Component that fetches app data), `compose.ts` (binds the app's auth / realtime /
  clock), `Client.tsx`, `types.ts`, `derive.ts`, `use<Widget>Callbacks.ts`. These
  import `@/` freely — they *are* app code — and reach back into this package only
  for the manifest.

Because the integration glue lives in the app, this package has **zero `@/`
imports**: anything it needs from the host crosses through a widget-core **port**
(session presence and logout via HostAuth, the API / IDP / time-service settings via
HostConfig, the auth-error event), never a direct app import.

## What lives here

`src/` holds exactly two things: the widgets, and `kit/` (the shared machinery
they're built from).

- `src/<widget>/` — `manifest.ts(x)` + `vendor-styles.ts` per widget, plus any
  widget-specific bits (e.g. `schedule-lite/transition-group.ts`,
  `schedule-full/{deep-link,hide-widget-toolbar}.ts`). `.tsx` when the manifest
  needs JSX, e.g. a `wrapTree` that renders an `EmotionShadowProvider`
  (schedule-full, registration).
- `src/index.ts` — the barrel: the small client-safe surface (clock hooks).
- `src/kit/` — everything not tied to one widget (by coupling, not consumer count: a generic module stays here even while only one widget uses it):
  - `uicore-host.ts` — `configureUicore()`: reads the HostConfig and HostAuth ports
    and calls uicore's `setConfig`, `setAccessTokenResolver` and `setAuthHandlers`.
    The resolver returns the `SESSION_PRESENT` placeholder while a session exists
    and throws only on a certain signed-out; `initLogOut` delegates to
    `HostAuth.logout`; 401/403 raise the `widget-auth-error` event. The app calls
    it once at startup; the web-component runtime calls it on its own uicore copy.
  - `compat/` — `uicore-swal` (the web-component build aliases `sweetalert2` to
    it; forwards to the widget-notify port), `uicore-ajaxloader` (the app-styled
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
  - `ClockProvider.tsx` (a re-export of uicore's clock context)
    — uicore component surfaces.
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

- `scripts/generate-assets.mjs` (npm script `assets`) reads each vendor
  stylesheet from the installed dists, splits out `@font-face`, and emits
  `src/kit/vendor-css/<name>.ts` (`export const sheet: VendorSheet`). Outputs
  are committed, so a fresh clone typechecks without running it.
- Font and image binaries land in `assets/` (committed). Generated url()
  references carry the `__WIDGET_ASSETS__` placeholder; `createWidgetShadow`
  substitutes it with `HostConfig.assetBaseUrl` at use time.
- A host serves `assets/` wherever it wants and says where in
  `HostConfig.assetBaseUrl`. Empty (the default) means the site root: this app
  syncs `assets/` into `public/` (`scripts/sync-widget-assets.mjs`, run by
  `copy:widget-assets` at `predev` / `prebuild`) and leaves the base empty.

## The layered architecture

Dependencies flow one way; uicore stays contained; the esbuild bundle pulls only
framework-free code:

```
app (src/)                     pages, DAL, the two renderers, and register-host.ts
   │  fills ports              (fills HostAuth / HostConfig / the renderer registry)
   ▼
src/widgets/<w>/               index / Client / compose / types  (app integration glue)
   ▼ imports (app → widgets)
packages/widgets               manifest + vendor-styles + uicore-host      ← THIS PACKAGE
   ▼
@openeventkit/widget-mount ──▶ @openeventkit/widget-core
   Widget dispatcher,            framework-free kernel: createWidgetShadow,
   WidgetRenderer, renderer       the WidgetManifest type (incl. WidgetBridge),
   registry, React-19 shims,      and the ports: host-auth, host-config,
   mutation-safe-props            widget-auth-error
      ▲
packages/web-components (esbuild) — own React 17; never imports widget-mount
```

## The mount contract (brief — full detail in WIDGET-MOUNTING.md)

- **`manifest`** (here) — which dist to `load`, the `vendorSheets` / `inlineStyles`
  to adopt, the `bridges` to run, the shadow host `elementTag` / `elementAttrs`.
- **`compose`** (in the app) — a hook binding the widget's live inputs (realtime
  store, auth-safe profile, bound callbacks, host vars) into a `WidgetComposition`.
- **`<Widget manifest composition renderAs>`** (`@openeventkit/widget-mount`) —
  resolves `renderAs` (`'react-component'` | `'web-component'`) via the renderer
  registry the app fills at startup, and mounts it. The two renderers live in the
  app (`src/components/widget/renderers/`, Next/Sentry/uicore-coupled):
  - **`reactComponent`** — runs the widget on the app's React 19 in a
    `createWidgetShadow` (Sentry boundary, `next/dynamic({ ssr: false })`, prop
    mutation-safety, React-19 compat shims). The default for every widget.
  - **`webComponent`** — runs it on its own bundled React 17 as a self-contained
    custom element from `packages/web-components/`.

Legacy widgets mount their own inner Redux `<Provider>` before their selectors
fire, so the host renders none (see `CONSTRAINTS.md` RC-R).

## Writing a new widget

- **Here (uicore-bound):** add `src/<widget>/manifest.ts` (dist `load`,
  `vendorSheets`, `bridges`, `elementTag`) + `src/<widget>/vendor-styles.ts`;
  export `./<widget>/manifest` from `package.json`.
- **In the app (`src/widgets/<widget>/`):** `index.tsx` (fetch + derive + render
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
- Root `CLAUDE.md` — project overview, contexts, cache/real-time architecture
