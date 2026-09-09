# Widget isolation — why the web components run their own React

Companion to [CONSTRAINTS.md](../widgets/CONSTRAINTS.md) (the containment map) and
[UPSTREAM.md](../widgets/UPSTREAM.md) (the upstream backlog). This doc records the
isolation model behind this package and its per-widget trade-offs.

The legacy widgets are React-16/17-era bundles (uicore 4.x, react-select 2,
react-bootstrap 0.x, slick, …). Two ways exist to host them without their era
leaking into a React-19 host:

- **Web components — this package.** Each widget runs on its **own bundled
  React 18.3.1**, isolated as a custom element. The React-19 compat shims
  (`compat/find-dom-node`, `compat/react-element-symbol`) vanish because the
  widget runs a React it stays compatible with. All nine widgets build
  (`./scripts/policy.mjs` WIDGETS), and the reference host mounts every widget
  that has a web-component build as one. Moving a widget back onto the host's
  React is a one-line identity swap at its call site — import its `/react`
  entry instead of `/web-component` — kept for QA on the dev-only gallery.
- **Modernization (UPSTREAM entry 8).** Rebuild each widget onto React 19 +
  modern deps (react-select 2→5, drop react-bootstrap 0.x, …). The long-term
  debt paydown — shipping a widget as a web component doesn't preclude
  modernizing it later; the isolation just stops paying rent once a widget is
  natively React-19.

Both paths need **CSS shadow isolation** either way (the widgets ship global
Bootstrap/slick/FA CSS) — the axis this package resolves is **React**.

**Why the bundled React is 18.3.1, not the widgets' native 16:** a React ≤16
runtime delegates events at `document`, which shadow-DOM retargeting breaks;
React 17 moved delegation to the render root — see **RC-Y** in CONSTRAINTS.md.
React 18 stays API-compatible with the React-16-era widgets (legacy context,
`findDOMNode`, class lifecycles). "React 16" below refers to a widget's
**native** lineage (what it was built against): eight widgets peer `react@^16`;
`my-orders-tickets-widget` is React 18 (`react@^18.2`).

The host↔widget handshake is the element's visit lifecycle — `mount()` (ports +
initial props), `setProps()` (replace), `unmount()`; nothing rides window. Full
contract: [WIDGET-MOUNTING.md](../widgets/WIDGET-MOUNTING.md).

---

## Rules & mechanisms

1. **Host must not create a stacking context.** A web component's shadow host (and its
   ancestors to root) must avoid `transform`/`opacity`/`filter`/`contain`/
   `will-change`/`position`+`z-index` — otherwise a redirected overlay's z-index
   traps and paints behind host chrome (the schedule-popover bug class). If a host
   must create one, give it a z-index that clears host chrome.
2. **Portals redirect into the shadow.** Pass a shadow-internal container:
   MUI `container`/`disablePortal`, react-select `menuPortalTarget`, react-laag
   container. Content then gets the adopted CSS and click-outside works.
   (sweetalert2 is aliased to a host notify shim in the web-component build —
   `lib/compat/uicore-swal.ts` forwards `Swal.fire` to the widget-notify port —
   so the ~78 KB library never bundles and there is no in-shadow swal to redirect.)
3. **Fonts** (shadow `@font-face` never registers): the vendor-css generator
   splits each sheet's `@font-face` blocks into a `fontFaces` field that
   `createWidgetShadow` injects into `document.head` once per sheet id; the
   binaries ship in this package's `assets/` behind the `__WIDGET_ASSETS__`
   placeholder (CONSTRAINTS U.2-U.4).
4. **Body-escape inventory**: the static analyzer
   (`./scripts/analyze-widgets.mjs`, the `widgets-analyze` bin) derives each widget's
   dependency footprint; portal/overlay escapes are handled per class by the
   `lib/bridges/` fix-ups (tooltip, click-outside, scoped portal CSS).
5. **Light-DOM carve-out** for any lib that refuses the shadow (**Stripe**): mount
   it outside the shadow. Self-styled iframes don't leak CSS, so this is safe.

---

## Per-widget tiers

Rated by boundary burden (data/auth/callback surface + fonts + portals).

| Widget | React axis | Fonts (R1) | Portals (R2) | Special | Tier |
|---|---|---|---|---|---|
| **speakers** | 16 | Glyphicons, slick | none | — | 🟢 Easy |
| **live-event** | 16 | FontAwesome | none | — | 🟢 Easy |
| **upcoming-events** | 16 | FontAwesome | none | — | 🟢 Easy |
| **event-feedback** | 16 | Glyphicons, FA | minimal | token in | 🟡 Med |
| **schedule-lite** | 16 | Glyphicons, FA | react-select | schedule Server Actions | 🟡 Med |
| **schedule-filters** | 16 | Glyphicons, FA | react-select | **shares `ScheduleStateProvider` context with schedule-full** | 🟠 Med-Hard |
| **schedule-full** | 16 | Glyphicons, FA | react-laag popovers, tooltip | needsLogin intent; optional shared state | 🔴 Hard |
| **my-tickets** | 17+ (MUI) | none | **MUI Drawer/Menu/Dialog** (all `container`-redirectable) | token/profile/syncSession | 🔴 Hard |
| **registration** | 17+ (MUI) | Glyphicons, FA | MUI + tooltip (sweetalert2 → host notify shim) | **Stripe → light DOM**; ~15 callbacks; login/passwordless | 🔴 Hardest |

Two cross-cutting notes:
- **my-tickets / registration are MUI-based** (MUI 5 needs React ≥17). They run on the
  same single bundled React 18.3.1 runtime as every other web component — there is no
  separate runtime tier.
- **schedule-filters ⇄ schedule-full share a React context** (`ScheduleStateProvider`).
  Two separate web components can't share context → that filter/view state must be
  **hoisted into the React-19 host** and fed to both as props/events.

---

## The irreducible residuals

Everything else reduces to a mechanism or a rule; these two don't fully:

1. **Autofill in a shadow is flaky** — Chrome autofills shadow inputs but has
   re-population/UI edge cases; Firefox is worse; password-manager extensions
   vary. Browser behavior we can't fully control. **Moderate UX residual** on the
   login/payment forms — accepted.
2. **Stripe must be light-DOM** — registration's card field can't live in the
   shadow. A scoped carve-out; **registration-only**.

Plus one cost engineered around, not away:
- **A second React ships to the browser.** A standalone bundle carries React 18 +
  uicore (~2.5 MB unminified) per widget; the shared build variant serves them
  once through the `runtime/` chunks and the host-inlined import map, at the
  price of a version coupling — all web components share one React/uicore
  version. See "Distribution variants" in the [README](./README.md); the
  implementor picks the variant.
