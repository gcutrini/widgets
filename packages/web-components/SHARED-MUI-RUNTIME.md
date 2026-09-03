# Shared MUI runtime surface

> Status: **implemented + browser-verified.** Companion to
> [ISOLATION-STRATEGY.md](./ISOLATION-STRATEGY.md),
> [RUNTIME-REQUIREMENTS.md](./RUNTIME-REQUIREMENTS.md), [UPSTREAM.md](../widgets/UPSTREAM.md),
> [CONSTRAINTS.md](../widgets/CONSTRAINTS.md). MUI is a shared runtime layer for the
> web-component widgets, the way React 17 and uicore already are.

## Problem it solved

The web-component widgets run their own React 17 in a shadow root, and MUI 5 is a
**peer dependency of uicore** (`openstack-uicore-foundation` declares
`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` as
peers). uicore's built `lib/*` therefore emits bare `require("@mui/material/...")`
and leaves the consumer — us — to satisfy it. The build used to satisfy it by
**bundling MUI into every output that touched it**, so `@mui/system` (the ~92 KB
styling engine) was bundled ~3× (in the shared runtime via `company-input-v2`, and again
in `registration.shared.js` and `my-tickets.shared.js`), with MUI component code
duplicated wherever widgets overlapped.

React solved this long ago: served **once** by the shared runtime, external to
every `.shared.js`. uicore submodules do the same. MUI was the one heavy peer that
never got this treatment.

## The shipped design: import-map-served MUI chunks

The served MUI surface is part of the shared runtime: the build generates one
ES-module chunk per served `@mui/*` / `@emotion/*` specifier into `runtime/`,
esbuild code-splitting factors their shared internals (`@mui/system`, emotion)
into common chunks with a SINGLE instance, and the host-inlined import map
resolves each bare specifier to its chunk. There is no separate layer to load
and no ordering: the browser fetches exactly the MUI chunks a widget's module
graph imports — non-MUI widgets never pull any, the MUI widgets
(registration, my-tickets, schedule-full) share one copy. `pin:mui5-react17`
in a manifest's `runtimeNeeds` keeps its build-time meaning: bundle any
non-served `@mui` import from the React-17 MUI-5 tree.

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
   `splitting: true`) with `muiReact17Plugin` pinning the React-17 MUI 5 tree.
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
**UNUSED** (exposed, unimported), or a **bare barrel** reappearing. It caught a
real hand-miss during bring-up (`@mui/icons-material/EmailRounded` from the
reg-lite dist), which is why the surface is generated + guarded rather than
hand-kept.

## Measured result (gzip)

- Non-MUI pages fetch no MUI chunks at all (the graph never imports them);
  the MUI pages de-duplicated the ~3× `@mui/system` copies into split chunks
  fetched once.

## Verified

`my-tickets` renders a full, styled MUI interface (Tabs, Buttons, Search, cards)
in Nunito Sans inside its shadow root, with MUI served once from the shared
runtime chunks and emotion shared across the shadow boundary — no
`createContext`/`{}`/resolver errors.

## Open

- `quirk:myTicketsFont` (my-tickets font patch) is retired once my-orders'
  `CustomTheme` sets `fontFamily` upstream (UPSTREAM entry 13).
