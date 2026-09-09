# Shared MUI runtime surface

> Companion to [ISOLATION-STRATEGY.md](./ISOLATION-STRATEGY.md),
> [RUNTIME-REQUIREMENTS.md](./RUNTIME-REQUIREMENTS.md), [UPSTREAM.md](../widgets/UPSTREAM.md),
> [CONSTRAINTS.md](../widgets/CONSTRAINTS.md). MUI is a shared runtime layer for the
> web-component widgets, the way React 18 and uicore already are.

## Why MUI is served

MUI 5 is a **peer dependency of uicore** (`openstack-uicore-foundation`
declares `@mui/material`, `@mui/icons-material`, `@emotion/react`,
`@emotion/styled` as peers), so uicore's built `lib/*` emits bare
`require("@mui/material/...")` and leaves the consumer — us — to satisfy it.
Bundling would satisfy it at a multiple: `@mui/system` (the ~92 KB styling
engine) into every output that touches MUI, with MUI component code duplicated
wherever widgets overlap. So MUI gets the same treatment as react and the
uicore submodules: served **once** by the shared runtime, external to every
`.shared.js`.

## The design: import-map-served MUI chunks

The served MUI surface is part of the shared runtime: the build generates one
ES-module chunk per served `@mui/*` / `@emotion/*` specifier into `runtime/`,
esbuild code-splitting factors their shared internals (`@mui/system`, emotion)
into common chunks with a SINGLE instance, and the host-inlined import map
resolves each bare specifier to its chunk. There is no separate layer to load
and no ordering: the browser fetches exactly the MUI chunks a widget's module
graph imports — non-MUI widgets never pull any, the MUI widgets
(registration, my-tickets, schedule-full) share one copy. `pin:mui5`
in a manifest's `runtimeNeeds` keeps its build-time meaning: bundle any
non-served `@mui` import from the package's MUI-5 tree.

## The MUI surface

The served surface is DERIVED from the bundler's own resolution graphs
(`deriveMuiServed` in `scripts/footprint.mjs`): every `@mui/*` SUBPATH the
widget graphs import — including imports made inside locally-bundled uicore
modules such as company-input-v2 — plus the `@emotion` packages policy
declares shared for their state (`EMOTION_SERVED` in `scripts/policy.mjs`:
cache + react). Bare package roots are barrels and stay local; other
`@emotion` helpers are stateless and bundle locally. Nothing is hand-listed,
so the surface cannot drift from what the code imports.

There are **no bare `@mui` barrels** in the surface — the two that existed
(my-tickets' `@mui/material`, full-schedule's `@mui/base`) were subpath-fixed
upstream (UPSTREAM entries), so the chunk carries only the components actually
used, not whole libraries.

## Build mechanics

1. **Runtime entries** — the build generates one ES-module entry per served
   specifier and bundles them in ONE esbuild pass (`format: esm`,
   `splitting: true`) with `mui5PinPlugin` pinning this package's MUI 5 tree.
2. **Shared widget builds** leave every served `@mui/*` / `@emotion/*` import
   bare (the browser resolves it through the import map); a `require()` call in
   a webpack-UMD dist goes through the require-to-import bridge. Non-served
   `@mui` imports bundle locally from the pinned v5 tree.
3. **The uicore stateful modules** (`lib/utils/config`, `lib/security/methods`)
   are served the same way, so `company-input-v2` (registration's MUI company
   field, bundled into `registration.shared.js`) reads config and tokens from
   the configured shared instances, not fresh empty copies — the widget bundle
   calls `configureUicore()` on them at load.
4. **No loader step** — the module graph pulls MUI chunks by itself.

## Single-instance requirements

- **emotion** is one instance (owned by the chunk); each widget's
  `EmotionShadowProvider` points that one emotion at its shadow root, so styles
  attach inside the shadow.
- **`@mui/system` / `@mui/material/styles`** live solely in the chunk, so theme +
  `styled` are coherent.
- Widgets still create their **own** theme objects (via `MuiThemeBridge`); sharing
  the MUI *code* does not force a shared *theme*.

## Analyzer guard

`analyze-widgets.mjs --check` derives each widget's direct `@mui/*`/`@emotion/*`
imports and fails on: **MISSING** (imported, not exposed → would resolve to `{}`),
**UNUSED** (exposed, unimported), or a **bare barrel** reappearing — the surface
is generated + guarded rather than hand-kept, so a hand-miss fails CI instead
of resolving to `{}` in the browser.

## Open

- `quirk:myTicketsFont` (my-tickets font patch) is retired once my-orders'
  `CustomTheme` sets `fontFamily` upstream (UPSTREAM entry 13).
