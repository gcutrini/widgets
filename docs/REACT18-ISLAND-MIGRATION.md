# React 17 → 18 island-runtime migration

Assessment for moving the web-component island runtime
(`packages/web-components`, pinned react/react-dom 17.0.2 + MUI 5.18) to React
18. The host itself runs React 19 and is not involved.

## Verdict

**Migrate to React 18.3.1, in two phases.** Nothing in the shipped widget code
breaks on 18; two peer contracts violated today become satisfied; both
hand-written React-18-API back-fills become native and get deleted. Going
straight to a React-19 runtime is not viable — 19 removes exactly what the
legacy dists stand on (`findDOMNode` for react-select@2, legacy context for
react-bootstrap, `ReactDOM.render`, the `react.element` symbol shape, @react-pdf
3's renderer internals). React 18 is the ceiling for shim-free legacy hosting;
React 19 for these widgets is the rebuild wave (UPSTREAM entry 8), not a runtime
swap.

## Why: the runtime is the laggard

The widget fleet has drifted 18-ward while the runtime stayed on 17:

- `my-orders-tickets-widget` peers `react ^18.2.0` — violated on 17 today.
- `react-toastify@11` (schedule-full) peers `^18 || ^19` and calls
  `React.useSyncExternalStore` unguarded — the reason the runtime carries a
  `useSyncExternalStore` back-fill. (react-redux is 7.2.9 everywhere and uses
  the guarded shim entries; it never needed the back-fill.)
- `react-content-loader@7.1` (registration) calls `React.useId` unguarded —
  the reason for the `useId` back-fill, added after a production crash on
  `/register`'s post-payment skeleton (UPSTREAM entry 18).

Every widget dependency released after 2022 assumes React 18; each new one is a
potential repeat of the same crash class. On 18 both back-fills go inert (they
guard with `if (!React.useX)`) and are deleted.

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
| emotion | 11.14 | OK, improves — flips to native `useInsertionEffect` on 18 |
| openstack-uicore-foundation | 4.2.x | OK — uses the guarded use-sync-external-store shim entries |
| react-toastify | 11.1.0 | **fixed by 18** — unguarded `useSyncExternalStore`, peer violated on 17 |
| react-content-loader | ≥7.1 | **fixed by 18** — unguarded `useId` |
| my-orders-tickets-widget | 1.0.16 | **fixed by 18** — peers `react ^18.2.0` |
| @react-pdf/renderer | 3.4.5 (schedule-full) | OK — reads renderer internals that exist in 18 (hard 19 blocker later) |
| @react-pdf/renderer | 4.9.0 (my-tickets) | OK — reconciler picker: `major <= 18` → same branch as 17 |
| react-stars | 2.2.5 | OK — createClass + unprefixed lifecycles: dev-only warnings |
| react-slick, pure-react-carousel, react-tooltip 3, react-spring, Stripe 3/7, formik, react-hook-form, final-form, history 4, moment, redux family, misc hooks libs | — | OK — React-agnostic or peers cover 18 |
| react-star-ratings | 2.3.0 | OK — but the `react-star-ratings>react` override must move 17.0.2 → 18.3.1 (UPSTREAM entry 17) |

Per-widget: no widget gets riskier on 18; schedule-full and my-tickets net
improve. `shim:elementSymbol` and the webpack findDOMNode alias belong to the
host-lane React-19 renderer and are untouched.

## Phase 1 — bump to 18.3.1 on legacy `ReactDOM.render` (~half a day incl. verification)

Zero behavior delta: a legacy root on 18 behaves identically to 17 (sync
commits, no automatic batching outside event handlers). The deprecation warning
is dev-build-only; shipped bundles are silent. `setProps` stays synchronous.

1. `packages/web-components/package.json`: react/react-dom `17.0.2` → `18.3.1`
   exact (18.3 adds the deprecation warnings that inventory the eventual 19
   rebuild — dev-only).
2. `pnpm-workspace.yaml`: `'react-star-ratings>react'` override → `18.3.1`;
   update the header comment. Mirror in any host-side override blocks (e.g. the
   reference host's deploy overlay) — overrides shadow, they don't merge.
3. `scripts/runtime-entries.mjs`: delete the react-entry back-fill block
   (`useSyncExternalStore` shim import + `useId` counter). `probeModules`
   enumerates the installed React's exports, so the runtime chunks pick up 18's
   full surface (useId, startTransition, useDeferredValue, …) with no code
   change. Keep the `use-sync-external-store` dependency — uicore's served
   chunks import its shim entries.
4. Rename `pin:mui5-react17` → `pin:mui5` (`widget-core` RuntimeNeed union, the
   three declaring manifests, `plugins.mjs`, `policy.mjs`, docs) — the plugin's
   mechanics are React-version-agnostic; only the name goes stale.
5. Docs sweep: the "React 17" statements across the four web-components md
   docs, `packages/widgets` CONSTRAINTS/WIDGET-MOUNTING/README/UPSTREAM (mark
   entry 18's back-fill containment retired), widget-mount, and the reference
   host's widget-test page and README.
6. Update the runtime-entries tests (assert no back-fill; react entry is plain).

pnpm notes: install re-materializes the MUI 5 set peered against react@18
(already present in the store); expect cosmetic unmet-peer warnings from the
≤17-era libs (they execute inside prebuilt dists).

### Verification
- Both build variants + analyzer `--check` + script tests + vitest.
- `/widget-test` gallery, all nine widgets, console clean apart from expected
  new 18.3 dev deprecations (catalogue them).
- Interactive smoke: schedule-full (redux + realtime), schedule-lite (day
  tabs — shadow-event canary), my-tickets (portals + PDF), event-feedback
  (stars), reconnect path.
- Registration payment flow with a test card — the one expensive check;
  schedule the deploy behind a QA window for it.

## Phase 2 — `createRoot` (separate, ~1–2 days incl. verification)

Where the real behavior deltas live; mandatory only at React 19.

- `src/element/define-web-component.js`: `createRoot(container)` held on the
  element; `root.render()` per `setProps`; `root.unmount()` on disconnect; the
  reconnect path must create a NEW root (an unmounted 18 root cannot be
  reused). Serve `react-dom/client` as a runtime specifier (add to
  `FRAMEWORK_SERVED`).
- Behavior deltas to verify: `root.render()` commits asynchronously (the
  synchronous `setProps` guarantee disappears), automatic batching of
  widget-internal setState in promises/timeouts (the class-era fetch/clock
  widgets), react-bootstrap's `OverlayTrigger` spawning a legacy sub-root
  inside a concurrent tree (functional in 18, sketchiest mix in the fleet).

## Timing

Neutral-to-slightly-easier for the uicore 5.x port (5.x still peers react
^17 — no conflict, no duplication). The createRoot work and any batching bugs
flushed now are down-payments on the eventual React-19 rebuild of the widget
fleet.

## Effort

| Item | Estimate |
|---|---|
| Phase 1 mechanical | ~3h |
| Phase 1 verification | ~2–3h (+ registration flow QA window) |
| Phase 2 (createRoot) incl. verification | ~1–2 days |
