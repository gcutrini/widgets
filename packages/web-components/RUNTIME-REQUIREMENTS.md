# Per-widget runtime requirements (declared, orchestrated, verified)

> Status: **implemented.** Companion to [ISOLATION-STRATEGY.md](./ISOLATION-STRATEGY.md),
> [SHARED-MUI-RUNTIME.md](./SHARED-MUI-RUNTIME.md), [CONSTRAINTS.md](../widgets/CONSTRAINTS.md),
> [UPSTREAM.md](../widgets/UPSTREAM.md). This describes how the web-component build decides
> which polyfills, pins, and shims each widget gets.

## Problem it solved

Build-time concerns — the MUI-5 pin, Node builtin stubs, the my-tickets font
patch — used to be attached to **the build**, not to the
**widgets that need them**: `build.mjs` applied every plugin to every widget, and
some self-scoped by hacky entry-name string matching (`entry.includes('my-tickets')`).
A widget that needed nothing special still paid for all of it, and the scoping
rotted.

The manifest was already the right home for per-widget declaration — each widget
declares its `bridges`, `vendorSheets`, `wrapTree`, `elementTag`. Build concerns
now live there too.

## The model: declare → orchestrate → verify

**The manifest declares WHAT a widget needs; the build orchestrates HOW; the
analyzer verifies the declaration matches reality.**

1. **Declare** — each widget's manifest carries `runtimeNeeds`, a small fixed
   vocabulary (`RuntimeNeed` in `@openeventkit/widgets/core/manifest`). Only the
   widgets that need something declare anything; the other six declare nothing.
2. **Orchestrate** — `scripts/build.mjs` (the `widgets-build` bin) maps each token to an
   esbuild plugin via `NEEDS_TO_PLUGINS` and selects per widget with `selectPlugins(needs)`.
   The build never hardcodes widget names.
3. **Verify** — `analyze-widgets.mjs --check` derives what each widget *actually*
   needs from its real dependency footprint and fails if a declaration is wrong
   (needs a token it didn't declare, or declares one it no longer needs).

So the derivation still exists — but as the **conscience** (a CI check), not the
**driver** (the build reads the declaration, not a scan).

## The vocabulary (`RuntimeNeed`)

Three tokens, each mapping to one build plugin:

| token | plugin | what it does |
|---|---|---|
| `pin:mui5-react17` | `muiReact17Plugin` | v5-era MUI/emotion → pin to the React-17 MUI 5 tree; in shared builds the served `@mui/*`/`@emotion/*` surface stays bare and resolves through the import map — see [SHARED-MUI-RUNTIME.md](./SHARED-MUI-RUNTIME.md) |
| `stub:node` | `nodePolyfills` | dist pulls Node built-ins (fs/zlib/…) → browser polyfills/stubs (esbuild-plugin-polyfill-node) |
| `quirk:myTicketsFont` | `myTicketsFontPlugin` | ships its own MUI theme with no `fontFamily` → build patches the site font in (behavioral; not import-visible) |

Today: `my-tickets` declares all three, `schedule-full` declares `pin`+`stub`,
`registration` declares `pin`. The other widgets declare none.

Token reads are not a per-widget need: every build resolves
`openstack-uicore-foundation/*` from the web-components package's own
`node_modules` (`uicorePinPlugin`, applied to every build), and each widget
bundle calls `configureUicore()` on the shared uicore chunks at load, so a dist
that imports `lib/security/methods` directly gets the configured instance.

## Derived vs declared (for the `--check` verifier)

The analyzer derives each widget's signature from its **real footprint** — its
dist imports plus what its manifest `wrapTree`/lib code pulls in — and classifies
via an auditable `RULES` table:

| Signature field | Source |
|---|---|
| `pin:mui5-react17` | dist or lib imports `@mui/*` or `@emotion/*` |
| `stub:node` | dist imports `@react-pdf/renderer` (Node built-ins) |
| react / MUI versions | `package.json` peers |

`quirk:myTicketsFont` is behavioral (a theme with no font), so it's **declared-only**
— the verifier accepts it without deriving it. Every derivable token must match
the declaration or `--check` fails.

## What the analyzer guards

`analyze-widgets.mjs --check` (the CI conscience) fails on:

- **uicore path drift** — a uicore submodule imported but outside the served
  runtime surface (its import-map resolution would fail). Consumer-count aware:
  a path used by ≥2 widgets must be served; a single-consumer path is bundled
  into its one widget.
- **MUI barrel roots** — a bare whole-package `@mui/*` import (the subpath
  surface itself is derived from the graphs, so it cannot drift — see
  [SHARED-MUI-RUNTIME.md](./SHARED-MUI-RUNTIME.md)).
- **barrel imports** — a bare-root import of a subpath-capable lib (`@mui/*`,
  `lodash`, `react-bootstrap`, …) that bundles a whole library; pre-existing ones
  are baselined in `analyze-widgets.baseline.json`, new ones fail.
- **declared-vs-derived** — the `runtimeNeeds` mismatch above.
- **unrecognized deps** — a dep no `RULES` entry covers, unless baselined.

## Done vs open

**Done:** the declarative vocabulary + `NEEDS_TO_PLUGINS`/`selectPlugins`
orchestration; the analyzer verifier + all four guards; per-widget plugin
selection (byte-identical output vs the old global-plugin build, proving it a
pure refactor).

**Open:**
- **reactComponent per-widget shims.** The React-19 compat shims
  (`find-dom-node`, `react-element-symbol`) are still imported unconditionally by
  the reactComponent renderer; they could be keyed on the signature like the
  web-component plugins are.

## Open questions / risks

- **Robustness of the source scans** — the analyzer regex-reads the widget
  manifests for its lists; a reformat can break a scraper. The runtime
  surfaces themselves are plain data / derivation (policy.mjs), no
  longer scraped.
- **Quirk tokens** must stay tiny and justified. `quirk:myTicketsFont` should be
  retired by fixing the font upstream in my-orders' `CustomTheme` (UPSTREAM
  entry 13), which would drop the token, the plugin, and shrink the vocabulary
  3 → 2.
