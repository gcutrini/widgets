# The React-18 web-component runtime

The web-component runtime (`packages/web-components`) runs **react/react-dom
18.3.1** on the `createRoot` API. The host runs React 19 and is not
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
  carries `useSyncExternalStore` and `useId`, the two APIs react-toastify
  and react-content-loader need (UPSTREAM entry 18). The
  `use-sync-external-store` dependency stays: uicore's served chunks import
  its shim entries.
- The MUI pin token is `pin:mui5` (`mui5PinPlugin`) — it pins bundles to this
  package's MUI 5 tree; its mechanics don't depend on the React version.
- Each element holds one React root per **connected span of a visit**:
  `mount()`'s first render creates it lazily, `setProps` renders on it,
  `unmount()` and `disconnectedCallback` unmount it (an unmounted 18 root
  cannot be reused — a reconnect or a new visit creates a fresh one, with the
  guard making the disconnect-then-unmount removal sequence a no-op second
  time). Commits are asynchronous and widget-internal setState batches
  automatically everywhere; nothing host-side reads the DOM after `setProps`,
  and readiness rides the `widget-painted` event — announced by a
  `FirstCommitSignal` wrapper (`useLayoutEffect`) placed below the error
  boundary, so a failed first render announces nothing.
- `react-dom/client` is served through the import map alongside react and
  react-dom.
- Dev builds still log deprecations from INSIDE the legacy dists —
  react-bootstrap's `OverlayTrigger` renders its overlays through legacy
  sub-root APIs (`unstable_renderSubtreeIntoContainer`), warning per overlay
  render in four widgets (schedule-full/lite, speakers, live-event).
  Production bundles are silent; those calls retire with the React-19 widget
  rebuild (UPSTREAM entry 8).

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

## Toward React 19

The runtime is as far as legacy hosting goes: the remaining React-19 blockers
live in the widget dists themselves (findDOMNode, legacy context, the
@react-pdf 3 internals) and retire with the widget rebuild (UPSTREAM entry
8). The uicore 5.x port is unaffected (5.x peers react ^17 — no conflict, no
duplication).
