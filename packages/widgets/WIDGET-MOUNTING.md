# Widget mounting — one contract, two renderers

This document is the contract a host implements to mount the legacy widgets: a
widget is **declared once** (`manifest`), **composed once** (`compose`), and
**rendered by the runtime the consumer imports** — per widget the package
exports both `@openeventkit/widgets/<widget>/web-component` (its own bundled
React 18, as a self-contained custom element, from the widget's name alone —
the widget's own bundle owns the manifest) and
`@openeventkit/widgets/<widget>/react` (the host's React 19, in the page's
tree, from the widget's full manifest). Host file paths below are the
reference host's.

Companion docs: [ISOLATION-STRATEGY.md](../web-components/ISOLATION-STRATEGY.md) (why the web-component path exists
and its trade-offs) and [CONSTRAINTS.md](./CONSTRAINTS.md) (the full root-cause
ledger — RC-U shadow hosting, RC-V React version, RC-Y web-component runtime).

---

## The three axes (why this shape)

Hosting a widget is really three independent choices we kept bundling together:

- **What the widget is** — its dist, stylesheets, bridges, host tag. Static.
  *Independent of how it runs.*
- **What live data it needs** — realtime + auth + callbacks, bound each render.
  *Independent of how it runs.*
- **Which React runs it** — the host's React 19 (a component in the page's tree)
  or its own bundled React 18 (a self-contained custom element). *The only axis
  that actually differs between the two renderers.*

Separating them means the first two are written **once** and the third is
picked by **which entry the consumer imports**: `<widget>/web-component`
mounts the web-component runtime (no manifest in the consumer's bundle),
`<widget>/react` mounts on the host React — a module you don't import is
code you don't ship.

---

## The vocabulary

| Name | Role | Reads as |
|---|---|---|
| `WidgetManifest` | static declaration | "what this widget is + needs" |
| `WidgetComposer` → `WidgetComposition` | live-data binding | "its realtime + auth + callbacks, per render" |
| `WidgetShadow` | shared shadow-DOM primitive | "the shadow the widget renders into" |
| `WidgetBridge` | host-agnostic DOM fix-up | "a shadow patch: emotion-mirror, click-outside…" |
| `<widget>/web-component` · `<widget>/react` | the component a page renders | "put a widget on the page" — the import path picks the runtime |
| `WidgetRenderers` | how it runs | `reactComponent` (host React, from a manifest) or `webComponent` (own React, from a name) — the host supplies both mounts |

---

## The homes

Dependencies flow one way. uicore is contained in the `src/lib/` + `src/<widget>/`
modules; the esbuild bundle pulls only framework-free code. Everything lives in
`@openeventkit/widgets`, split into three layers:

```
src/core/  (./core)      framework-free kernel — imported by BOTH the host and the esbuild build.
   ▲                     WidgetManifest type (incl. WidgetBridge), createWidgetShadow, + host ports.
src/mount/ (./mount)     React mount contract — <Widget>, WidgetRenderers, the renderer slots,
   ▲                     the generic renderer factories, configureWidgetHost (./host),
   │                     and the React-19 compat / prop-mutation-safety utilities. Host-side only.
src/<widget>/ + src/lib/ the uicore-bound part of each widget: manifest + vendor-styles.
   ▲                     (integration glue — compose/Client/index — lives in the host, src/widgets/catalog/<w>.)
HOST (separate repo)     builds its two renderers from the ./mount/renderers/react-component and
                         ./mount/renderers/web-component factories and hands them to
                         configureWidgetHost at startup.
```

### 1 · `./core` — the framework-free kernel

No React runtime, no widget specifics. It holds what hosting *any* widget
requires, and the ports the host fills. Bundled into the web components, so a
test (`src/__tests__/core-framework-free.test.ts`) enforces that its files
import nothing beyond core siblings and react types.

```
src/core/  (./core barrel + ./core/* wildcards)
  manifest.ts        WidgetManifest, WidgetBridge, WidgetComponent, webComponentTag
  widget-shadow.ts   createWidgetShadow() → WidgetShadow             (the one shadow primitive)
  vendor-sheet.ts    VendorSheet
  host-auth.ts       HostAuth port — session presence + logout the host registers
  host-config.ts     HostConfig port — apiBaseUrl / idpBaseUrl / oauth2ClientId / timeApiUrl the host registers
  widget-auth-error.ts   the 401/403 DOM event the injected uicore auth handler raises and the host dialog handles
  widget-notify.ts   the notification DOM event the sweetalert2 shim raises and the host dialog handles
  widget-error.ts    the render-error DOM event the bundle's boundary raises and the host-side renderer rethrows

src/lib/bridges/   (implementations of the WidgetBridge contract)
  emotion-mirror.ts · click-outside-retarget.ts · tooltip.ts · scoped-portal-css.ts
  Each is a (root: ShadowRoot) => cleanup fix-up for a LEGACY-STACK behavior
  (emotion 11, react-tooltip@3, document-level click-outside, portaled vendor
  CSS), so they live with the legacy isolation layer; manifests declare them,
  createWidgetShadow just runs them.
```

`@font-face` extraction and portal-sheet injection are **steps
inside `createWidgetShadow`**, not bridges — a bridge is a `(root) => cleanup`
runtime fix-up for a shadow-hostile library, run after the shadow is prepared.

```ts
export type WidgetComponent = ComponentType<Record<string, unknown>>;
export type WidgetBridge = (root: ShadowRoot) => void | (() => void);

export interface VendorSheet {
  readonly id: string;        // stable identity — sheet caching + font-face dedup
  readonly css: string;
  readonly fontFaces: string; // split out; injected to document.head (can't live in shadow)
}

/** Static, runtime-independent declaration of a widget's hosting needs. */
export interface WidgetManifest {
  readonly name: string;                                     // web-component tag base, Sentry title, cache-key
  readonly load: () => Promise<{ default: WidgetComponent }>;
  readonly vendorSheets?: readonly VendorSheet[];            // adopted into the shadow; array order = cascade
  readonly inlineStyles?: readonly string[];                 // hand-authored CSS strings
  readonly portalSheets?: readonly VendorSheet[];            // ALSO to document.head (body-portaled UI)
  readonly bridges?: readonly WidgetBridge[];                // shadow fix-ups, run by createWidgetShadow
  readonly wrapTree?: (children: ReactNode) => ReactElement; // React-context wrap (emotion-11); per-widget
  readonly elementTag?: string;                              // default 'div'; semantic or custom-element tag
  readonly elementAttrs?: Readonly<Record<string, string>>;
  readonly runtimeNeeds?: readonly RuntimeNeed[];            // wc-build-actionable needs (pin:mui5 | stub:node | ...)
}
```

The manifest declares no prop contract for the web component — the renderer
hands the element its initial props in `mount({ ... props })` and replaces them
via `setProps(obj)` while the visit is open. The one
web-component-specific block is `runtimeNeeds`: the build-actionable requirement
tokens the esbuild build orchestrates from (see
../web-components/RUNTIME-REQUIREMENTS.md).

```ts
/** A shadow root prepared for a widget: sheets adopted, @font-face extracted, bridges running. */
export interface WidgetShadow {
  readonly root: ShadowRoot;         // for consumers that scope to it (e.g. an emotion cache)
  readonly container: HTMLElement;   // the <div> inside the shadow to render the widget's React tree into
  dispose(): void;                   // tear down bridges + adopted styles
  connectBridges(): void;            // restart bridges after dispose() (custom-element reconnect)
}
export function createWidgetShadow(
  host: HTMLElement,
  manifest: WidgetManifest,
): WidgetShadow;
```

### 2 · `./mount` — the mount contract

`<Widget>`, the `WidgetRenderers` slots, the
host's setup call, and the React-19 compat / prop-mutation-safety utilities.
Host-side only — the esbuild bundle never imports it (the bundle has its own
element machinery).

```
src/mount/  (./mount barrel; renderers + compat via their own subpaths)
  create-widget-component.tsx   builds the per-widget components the catalog entries export
  Widget.tsx            internal dispatcher; picks the renderer from the identity prop
  mount-props.ts        the two Mount prop types
  composition.ts        WidgetComposition, WidgetComposer (the mount layer's input contract)
  registry.ts           WidgetRenderers — the two named renderer slots the host fills
  configure-widget-host.ts   configureWidgetHost (exported as ./host, NOT on the barrel — it pulls uicore)
  renderers/            react-component · web-component (generic mount factories; hosts inject
                        lazy-loading, error boundary, bundle base path)
  use-element-ref.ts    fans a forwarded ref out alongside the renderer's internal one
  mutation-safe-props.ts   shallow-copy so a widget's in-place prop mutations can't reach host state
  compat/               find-dom-node · react-element-symbol · react-dom-with-find-dom-node (React-19 shims)
```

```tsx
// Two Mount contracts on purpose: the widget's own bundle owns the manifest,
// so the web-component Mount takes only the widget's name; the react-component
// Mount runs the widget from its full manifest on the host React. Both forward
// a ref to the host element. The host fills both slots at setup:
export interface ManifestMountProps {
  manifest: WidgetManifest;
  composition: WidgetComposition;
  ref?: Ref<HTMLElement>;
}
export interface WebComponentMountProps {
  name: string;
  composition: WidgetComposition;
  ref?: Ref<HTMLElement>;
}
export interface WidgetRenderers {
  reactComponent?: ComponentType<ManifestMountProps>;
  webComponent?: ComponentType<WebComponentMountProps>;
}

// The import path picks the renderer — consumers never render <Widget>:
//   import Registration from '@openeventkit/widgets/registration/web-component';
//   import ExtraQuestions from '@openeventkit/widgets/extra-questions/react';
//   <Registration composition={…} />   <ExtraQuestions composition={…} />
```

### 3 · The uicore-bound part — `src/<widget>/` + `src/lib/`

Per widget, just the `manifest` (loads the dist, declares sheets/bridges/tag) and
`vendor-styles` (its CSS). Everything else about a widget — data fetch, live-state
binding, the Client wrapper — is host integration glue and lives in the host under
its `src/widgets/catalog/<widget>/`. See this package's [README](./README.md).

### 4 · The two renderers + the host's one setup call

The generic renderer mounts ship here (`./mount/renderers/react-component`,
`./mount/renderers/web-component`); the host configures them with its own
pieces and hands the results to `configureWidgetHost({ config, auth,
renderers })` from `@openeventkit/widgets/host` — its single setup call,
imported once for its side effect so it runs at module eval, before any widget
renders. It fills the HostConfig port (proxy base + IDP settings), the
HostAuth port (session presence + logout, from the host's session-token
authority), registers the renderers, and calls `configureUicore()` from
`./uicore-host`, which hands uicore its config, token resolver and auth
handlers — owning that ordering (uicore reads the config port eagerly). The
resolver and handlers read the ports at call time.

- **`reactComponent`** — `createReactComponentRenderer({ resolveComponent,
  Boundary? })`. The host supplies only `resolveComponent` (how the lazy load
  happens — e.g. Next's `dynamic(manifest.load, { ssr: false })`) and
  optionally an error `Boundary`. The renderer does the rest:
  `createWidgetShadow(ref, manifest)`, renders the widget into `container` on
  the host's React 19 wrapped by `manifest.wrapTree`, provides
  `ShadowRootContext` by default, seeds uicore i18n itself
  (`lib/compat/uicore-i18n`), and side-effect-imports the React-19 compat
  shims (`find-dom-node`, `react-element-symbol`).
- **`webComponent`** — `createWebComponentRenderer({ bundleBasePath,
  Boundary? })`. Loads `${manifest.name}.shared.js` as an ES module, awaits
  `customElements.whenDefined`, then drives the element's **visit
  lifecycle**: `mount({ hostAuth, hostConfig, props })` opens the visit
  (ports and the complete initial prop set in one call), `setProps(props)`
  REPLACES the whole prop bag while it's open (React semantics — a key
  absent from the bag is gone), and `unmount()` closes it, unmounting the
  widget's React tree so its effect cleanups run. The renderer ties the
  visit to its own effect lifecycle, so the widget is torn down on real
  unmount AND when the router hides the page in an `<Activity>` boundary
  (which keeps the DOM connected — the element's `disconnectedCallback`
  never fires there) and mounted fresh, from current props, on return. The
  bundle's shared imports (react, the exposed uicore/MUI surfaces) stay bare
  and resolve through the import map the host inlines (first in the root
  layout's body) to the generated `runtime/` chunks — the browser walks the
  module graph; there is no load ordering. The bundle has its own copies of
  the core ports; `mount` registers the host impls into them and configures
  the shared uicore, and the element defers shadow setup until that handshake
  has happened — the DOM element is the only host↔widget channel.

  Two DOM events cross back from the element:
  - `widget-error` (`./core/widget-error`) — a render error's full path is:
    the widget throws → the bundle's React boundary catches it → the
    boundary dispatches `widget-error` on the element → this renderer's
    listener stores it → the next render rethrows it into the host `Boundary`
    — so both runtimes end at the same fallback. Bundle load failures and the
    define timeout throw into the same boundary directly. Event-handler and
    async errors stay uncaught, exactly as in React.
  - `widget-painted` (`./core/widget-painted`) — dispatched (bubbling) one
    frame after the visit's first commit, so a host skeleton can reveal on an
    announced signal. Fires once per visit.

---

## The composer

The composer runs in the **host's React 19** for both renderers — the
web-component can't run host hooks inside its own React, so live state is always
bound host-side and handed across the boundary. Composers live with the rest of
the integration glue in the host's `src/widgets/catalog/<widget>/compose.ts`.

```ts
export interface WidgetComposition {
  readonly props: Record<string, unknown>;
}
// A use-prefixed hook: it binds live state and needs the widget's server-derived props.
export type WidgetComposer<TServerProps = void> =
  (serverProps: TServerProps) => WidgetComposition | null;   // null = required data not ready
```

## The stability contract

The legacy widgets treat props as **owned, mutable state** and **re-derive their
entire internal store whenever a prop changes identity**, while a React context
app changes references often. Without a contract, an unrelated host re-render
(e.g. logout raising an overlay flag) re-clones the ~40-event array into fresh
references and the widget re-initializes — a visible flicker. The contract
couples the widget to the host's **data**, not its **render cadence**:

> **A widget's props change identity if and only if its data actually changed.**

If that holds, the renderer memoizes on the mutation-safe props and React skips
the legacy subtree on any unrelated host re-render. It is enforced at three
points (host hook names below are the reference host's):

1. **Stable sources.** Realtime data (`useRealTimeEvents`, `useRealTimeSummit`)
   comes from `useSyncExternalStore` — stable until a real update. `userProfile`
   is memoized (`useWidgetSafeProfile`). Server props are constant per mount.
2. **Stable callbacks — *and* they read live state.** Every `use*Callbacks`
   hook returns a **memoized** bundle of **`useCallback`'d** members. Never hand
   a widget an inline arrow or a fresh object literal.

   The second half matters just as much: a callback handed to a widget must be
   **stable in identity *and* read its reactive inputs live at call time** —
   never bake a reactive value (like `isLoggedIn`) into the callback's identity.
   A legacy widget captures a callback in its memoized event rows and **never
   re-threads a new one**, so a callback whose identity changes when auth flips
   leaves the widget holding the stale (anonymous) version — a post-login click
   then re-defers and reopens the login modal. The host's auth guard therefore
   returns a stable callback that reads `isLoggedIn` live from a ref (the
   `useEffectEvent` shape). Rule: **stable identity, live reads.**
3. **Isolate only on change.** `useMutationSafeProps`
   (`src/mount/mutation-safe-props.ts`, applied by both renderers) re-clones a
   prop only when its source reference changed, and returns the same object
   otherwise — so unchanged data yields the same element and the legacy subtree
   is skipped. (It also preserves the widget's own in-place mutations between
   renders, which the legacy model expects. It exists because the widgets
   mutate what they're handed — CONSTRAINTS RC-W.)

For a composer this means: return **memoized data + `useCallback`'d callbacks** —
nothing that changes identity on an unrelated render — and don't re-implement
isolation or memoization yourself; the renderers own that for every widget. If
a widget mutates a **nested** prop value (not just a top-level field), escalate
`mutation-safe-props` to a deep copy for that prop — see the note in that
module.

## The call site

The per-widget `Client.tsx` (in the host, its `src/widgets/catalog/<widget>/`) calls the
composer hook and renders the widget component it imported — the import path
is the runtime choice (`/web-component` keeps the manifest graph out of the
host bundle; `/react` pulls the full manifest and runs on the host React):

```tsx
import ScheduleLiteWidget from '@openeventkit/widgets/schedule-lite/web-component';
import { useScheduleLiteComposition } from './compose';

export default function Client({ serverProps }: { serverProps: ScheduleLiteServerProps }) {
  const composition = useScheduleLiteComposition(serverProps);
  return <ScheduleLiteWidget composition={composition} />;
}

// Host-React variant — the only widget mounted this way today is
// extra-questions (it has no web-component build):
//   import ExtraQuestionsWidget from '@openeventkit/widgets/extra-questions/react';
//   <ExtraQuestionsWidget composition={composition} />
```
