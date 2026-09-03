# Widget Isolation — Decision Doc: Web Components vs. React-19 Modernization

Companion to [CONSTRAINTS.md](../widgets/CONSTRAINTS.md) (the containment map) and
[UPSTREAM.md](../widgets/UPSTREAM.md) (the upstream backlog). This doc weighs **how** to
retire the React-19 compat layer the legacy widgets impose.

> **Shipped:** the web components run **React 17.0.2**. A React ≤16 runtime
> delegates events at `document`, which shadow-DOM retargeting breaks; React 17
> moved delegation to the render root and fixed it — see **RC-Y** in
> CONSTRAINTS.md. The host↔island handshake is the element's `configureHost()` (ports only; nothing rides window). "React 16"
> below refers to the widgets' **native** React lineage (what they were built
> against), not the runtime that hosts them — and it's the *dominant* lineage,
> not a uniform one: eight widgets peer `react@^16`, but `my-orders-tickets-widget`
> is React 18 (`react@^18.2`). Running an 18-built widget on the React-17 runtime
> is a latent risk if it reaches for 18-only APIs.

---

## The problem

The legacy widgets are React-16/17-era bundles (uicore 4.x, react-select 2,
react-bootstrap 0.x, slick, etc.). Today they run on the host's **shared React
19**, held together by version shims (`compat/find-dom-node`,
`compat/react-element-symbol`) plus a shadow-DOM + vendor-CSS containment layer.
Two mutually-exclusive ways to delete the version shims:

- **Strategy A — web components.** Each widget runs on its **own bundled
  React**, isolated as a custom element. The shims vanish because the widget
  runs a React it stays compatible with. *Isolation.*
- **Strategy B — Modernization (UPSTREAM Entry 8).** Rebuild each widget onto
  **React 19** + modern deps (replace react-select 2→5, drop react-bootstrap
  0.x, etc.). The shims vanish because the incompatibility is gone. *Migration.*

Both still need **CSS shadow isolation** (the widgets ship global Bootstrap/
slick/FA CSS) — that tax is shared. The axis that differs is **React**.

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
   `kit/compat/uicore-swal.ts` forwards `Swal.fire` to the widget-notify port —
   so the ~78 KB library never bundles and there is no in-shadow swal to redirect.)
3. **Fonts** (shadow `@font-face` never registers): the vendor-css generator
   splits each sheet's `@font-face` blocks into a `fontFaces` field that
   `createWidgetShadow` injects into `document.head` once per sheet id; the
   binaries ship in this package's `assets/` behind the `__WIDGET_ASSETS__`
   placeholder (CONSTRAINTS U.2-U.4).
4. **Body-escape inventory**: the static analyzer
   (`./scripts/analyze-widgets.mjs`, the `widgets-analyze` bin) derives each widget's
   dependency footprint; portal/overlay escapes are handled per class by the
   `kit/bridges/` fix-ups (tooltip, click-outside, scoped portal CSS).
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
  same single bundled React 17.0.2 runtime as every other web component — there is no
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
   login/payment forms.
2. **Stripe must be light-DOM** — registration's card field can't live in the
   shadow. A scoped carve-out; **registration-only**.

Plus one cost to engineer around:
- **N× bundles** — each web-component bundles React 17 + uicore (~2.5 MB unminified).
  Mitigation: a **shared "web-component runtime"** chunk (React 17 + uicore) loaded once,
  widgets as separate entries. (Reintroduces a version-coupling: all React-17
  web components share one React/uicore version.)

---

## Strategy A vs. B — trade-offs

| | **A — Web components** | **B — Modernize (Entry 8)** |
|---|---|---|
| Deletes version shims | ✅ via isolation | ✅ via migration |
| CSS shadow / `RC-U` tax | stays | stays |
| Per-widget risk | **Low** — no React upgrade; widget runs its native React | **High** — replace react-select/react-bootstrap/uicore per widget |
| Incremental? | ✅ widget-by-widget, ship the easy trio first | partially; uicore is a shared peer (atomic-ish) |
| Pays down tech debt | ❌ widgets frozen on React 16/17 | ✅ modernized |
| Runtime cost | two React runtimes; N× bundle (mitigable) | single runtime |
| Maturity | ✅ shipped — island bundles for all nine widgets; registration mounts as one in production | not started; uicore 5.x doesn't even help (still React 17, react-select 2) |
| New build surface | per-widget web-component build (standardizable) | per-widget source rewrite |

**They are not fully exclusive:** a widget can be **shipped as a web component now**
(low-risk, ships value) and **modernized later** (debt paydown) — the web-component
path doesn't burn the modernization bridge.

---

## Recommendation

**Adopt web components as the near-term path, modernization as the long-term option —
not a race between them.**

Rationale: web components are **shipping** (all nine widgets build; registration
runs as one in production), **incremental**, and **low-risk per widget** (no
React-upgrade gamble). Modernization (Entry 8) remains the eventual
debt-paydown, and shipping a widget as a web component doesn't preclude
modernizing it later.

**The standard "web component kit"** that makes each widget cheap to wrap:
our own custom element (`./src/element/define-web-component.js`)
on a shared React-17 runtime layer, the head-injected font pipeline, the
`kit/bridges/` portal/overlay fix-ups, and the light-DOM carve-out (Stripe
slot). The widget repos ideally own the custom-element entry + its CSS
(self-contained, per the shadow-CSS research); the host owns only data wiring +
theme CSS custom properties (which pierce the shadow).

**State** — all nine widgets build as island bundles
(`./scripts/policy.mjs` WIDGETS), the reference host's dev-only gallery mounts
every one in web-component mode, and registration ships as a web component in
production (Stripe in the light-DOM slot; sweetalert2 through the host notify
shim; the MUI widgets share the served MUI chunks). The remaining widgets mount
in the host's tree on the shadow-react renderer by default — flipping one to
its island is a `renderAs` change once its interaction surface is proven under
exercise (open/tab/dismiss every overlay), which is the bar my-tickets still
has to pass before the in-tree mounts can be retired.

---

## Packaging — the widget exposes both distribution modes

The "shared runtime vs. per-widget bundle" question is **not a fleet-wide
choice** — the widget defers it to the implementor through **two build
variants** built from the same source:

- **`<widget>.shared.js`** — an ES module whose shared imports (`react`,
  `react-dom`, `react/jsx-runtime`, the served uicore + MUI surfaces) stay
  bare and resolve through an import map the host inlines to the generated
  `runtime/` chunks. Small (widget code only). The default `scripts/build.mjs`
  (`widgets-build`) run emits this variant plus the chunks + `import-map.json`;
  it is the only variant the reference host loads.
- **`<widget>.standalone.js`** — React 17 bundled in. Drop-in, works anywhere,
  larger (~2.5 MB). For any integrator who just wants it to work. An opt-in
  build: `build.mjs --standalone` (`pnpm build:standalone` in this package,
  `pnpm build:wc:standalone` at this repo's root) emits only these files.

**Shared runtime + contract.** The interop surface is the import map: one
generated ES-module chunk per served bare specifier, single-instance stateful
internals via esbuild code-splitting, `import-map.json` as the resolution
table the host inlines before any widget module loads. The host↔island
ports handshake (`hostAuth`/`hostConfig`) crosses through the element:
the renderer calls `el.configureHost(ports)` before `setProps`, and the
element defers shadow setup + uicore configuration until both it and DOM
connection have happened. Nothing rides window.

**Who picks what:**
- **The reference host** (opts in): inline the import map once + load each
  widget's `<widget>.shared.js` module → one React 17 for all web components,
  small per-widget bytes, the browser fetches shared chunks on demand.
- **A third-party integrator**: load `<widget>.standalone.js` → no runtime, no
  coordination.

Neither variant enters the host's React-19 module graph — isolation holds both
ways. The only fleet-level commitment is that both variants can be built from
the same source + the import-map contract.

---

## Open decisions

- Who owns the web-component build — each widget repo (preferred; owns its dep
  graph + CSS) vs. a central web-component builder in this repo.
- Accepting the autofill residual on the login/registration forms.

Resolved (see Packaging): shared-runtime vs. per-widget is a per-consumer
choice — the widget ships both variants and the implementor picks; the
reference host opts into the shared runtime. All nine widgets build as web
components.
