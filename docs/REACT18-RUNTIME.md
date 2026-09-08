# The React-18 web-component runtime — and the createRoot plan

The web-component runtime (`packages/web-components`) runs **react/react-dom
18.3.1** on legacy `ReactDOM.render`. The host runs React 19 and is not
involved. React 18 is the ceiling for shim-free legacy hosting: React 19
removes exactly what the legacy dists stand on (`findDOMNode` for
react-select@2, legacy context for react-bootstrap, `ReactDOM.render`, the
`react.element` symbol shape, @react-pdf 3's renderer internals). React 19
for these widgets is the rebuild wave (UPSTREAM entry 8), not a runtime swap.

## Current state

- `packages/web-components/package.json` pins react/react-dom `18.3.1` exact.
- The `react-star-ratings>react` override is `18.3.1` in `pnpm-workspace.yaml`
  and in host-side override blocks (overrides shadow, they don't merge).
- The runtime's react entry is plain — no back-fills. React 18 natively
  carries `useSyncExternalStore` and `useId`, the two APIs the runtime used
  to back-fill for react-toastify and react-content-loader (the latter was a
  production crash class — UPSTREAM entry 18, resolved). The
  `use-sync-external-store` dependency stays: uicore's served chunks import
  its shim entries.
- The MUI pin token is `pin:mui5` (`mui5PinPlugin`) — it pins bundles to this
  package's MUI 5 tree; its mechanics don't depend on the React version.
- Legacy `ReactDOM.render` on 18 behaves identically to 17: sync commits, no
  automatic batching outside event handlers, `setProps` commits
  synchronously. React logs a dev-build-only deprecation for it (one per
  widget mount); production bundles are silent. That warning retires with
  phase 2 below.

## Compatibility inventory (evidence-checked against installed dists)

Fleet-wide: zero `React.version` checks (except @react-pdf 4's reconciler
picker, which takes the same branch for 17 and 18), zero `__SECRET_INTERNALS`
in widget dists proper, zero `flushSync`, zero string refs, no React-19-only
API references.

| Dependency | Version | React-18 verdict |
|---|---|---|
| react-select | 2.4.4 | OK — findDOMNode + childContextTypes exist in 18 (die in 19) |
| react-bootstrap | 0.33.1 | OK — legacy context, findDOMNode, `unstable_renderSubtreeIntoContainer` all functional in 18 |
| react-redux | 7.2.9 | OK — peers `^16.8 \|\| ^17 \|\| ^18`; batches via `unstable_batchedUpdates` |
| MUI + @mui/base | 5.18.0 / 5.0.0-alpha.127 | OK — peers `^17 \|\| ^18 \|\| ^19`; `useId` util is guarded |
| emotion | 11.14 | OK — native `useInsertionEffect` on 18 |
| openstack-uicore-foundation | 4.2.x | OK — uses the guarded use-sync-external-store shim entries |
| react-toastify | 11.1.0 | satisfied — its unguarded `useSyncExternalStore` is native on 18 |
| react-content-loader | ≥7.1 | satisfied — its unguarded `useId` is native on 18 |
| my-orders-tickets-widget | 1.0.18 | satisfied — peers `react ^18.2.0` |
| @react-pdf/renderer | 3.4.5 (schedule-full) | OK — reads renderer internals that exist in 18 (hard 19 blocker later) |
| @react-pdf/renderer | 4.9.0 (my-tickets) | OK — reconciler picker: `major <= 18` → same branch as 17 |
| react-stars | 2.2.5 | OK — createClass + unprefixed lifecycles: dev-only warnings |
| react-slick, pure-react-carousel, react-tooltip 3, react-spring, Stripe 3/7, formik, react-hook-form, final-form, history 4, moment, redux family, misc hooks libs | — | OK — React-agnostic or peers cover 18 |
| react-star-ratings | 2.3.0 | OK — rides the `react-star-ratings>react` 18.3.1 override (UPSTREAM entry 17) |

No widget is riskier on 18 than on 17; the dev-only 18.3 deprecation warnings
(`defaultProps`, legacy context) inventory the eventual React-19 rebuild.

## Phase 2 — `createRoot` (~1–2 days incl. verification)

Where the real behavior deltas live; mandatory only at React 19.

- `src/element/defineWidgetWebComponent.js`: `createRoot(container)` held per
  visit; `root.render()` per `setProps`; `root.unmount()` on unmount() and
  disconnect. An unmounted 18 root cannot be reused — every new visit creates
  a new root (the mount/unmount visit lifecycle already models this). Serve
  `react-dom/client` as a runtime specifier (add to `FRAMEWORK_SERVED`).
- The `widget-painted` announcement rides `ReactDOM.render`'s third-argument
  callback, which `root.render()` doesn't have — rework it (e.g. an effect in
  a kit wrapper component announcing the visit's first commit).
- Behavior deltas to verify: `root.render()` commits asynchronously (the
  synchronous `setProps` guarantee disappears), automatic batching of
  widget-internal setState in promises/timeouts (the class-era fetch/clock
  widgets), react-bootstrap's `OverlayTrigger` spawning a legacy sub-root
  inside a concurrent tree (functional in 18, sketchiest mix in the fleet).
- Verification ladder: both build variants + analyzer `--check` + script
  tests + vitest; `/widget-test` gallery, all nine widgets; interactive
  smoke (schedule-full redux + realtime, schedule-lite day tabs, my-tickets
  portals + PDF, event-feedback stars, reconnect path); registration payment
  flow with a test card behind a QA window.

## Timing

Neutral-to-slightly-easier for the uicore 5.x port (5.x still peers react
^17 — no conflict, no duplication). The createRoot work and any batching bugs
it flushes are down-payments on the eventual React-19 rebuild of the widget
fleet.
