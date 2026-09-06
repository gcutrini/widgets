# Widget mounting — one contract, two renderers

This document is the contract a host implements to mount the legacy widgets: a
widget is **declared once** (`manifest`), **composed once** (`compose`), and
**rendered by a swappable renderer** (`<Widget>`) — `reactComponent` (the
host's React 19, in the page's tree, from the widget's `manifest`) or
`webComponent` (its own bundled React 17, as a self-contained custom element,
from the widget's `name` alone — its own bundle owns the manifest). Host
file paths below are the reference host's.

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
  or its own bundled React 17 (a self-contained custom element). *The only axis
  that actually differs between the two renderers.*

Separating them means the first two are written **once** and the third is
picked by **which identity prop the page passes**: `name` mounts the
web-component runtime (no manifest in the host bundle), `manifest` mounts on
the host React.

---

## The vocabulary

| Name | Role | Reads as |
|---|---|---|
| `WidgetManifest` | static declaration | "what this widget is + needs" |
| `WidgetComposer` → `WidgetComposition` | live-data binding | "its realtime + auth + callbacks, per render" |
| `WidgetShadow` | shared shadow-DOM primitive | "the shadow the widget renders into" |
| `WidgetBridge` | host-agnostic DOM fix-up | "a shadow patch: emotion-mirror, click-outside…" |
| `<Widget name>` / `<Widget manifest>` | the component a page renders | "put a widget on the page" — `name` runs the web-component runtime, `manifest` runs on the host React |
| `WidgetRenderer` | how it runs | `'react-component'` (host React, from a manifest) or `'web-component'` (own React, from a name) |

---

## The homes

Dependencies flow one way. uicore is contained in the `src/lib/` + `src/<widget>/`
modules; the esbuild bundle pulls only framework-free code. Everything lives in
`@openeventkit/widgets`, split into three layers:

```
src/core/  (./core)      framework-free kernel — imported by BOTH the host and the esbuild build.
   ▲                     WidgetManifest type (incl. WidgetBridge), createWidgetShadow, + host ports.
src/mount/ (./mount)     React mount contract — <Widget>, WidgetRenderer, the renderer registry,
   ▲                     the generic renderer factories, configureWidgetHost (./host),
   │                     and the React-19 compat / prop-mutation-safety utilities. Host-side only.
src/<widget>/ + src/lib/ the uicore-bound part of each widget: manifest + vendor-styles.
   ▲                     (integration glue — compose/Client/index — lives in the host, src/widgets/catalog/<w>.)
HOST (separate repo)     builds its two renderers from the ./mount/renderers/shadow-react and
                         ./mount/renderers/web-component factories and hands them to
                         configureWidgetHost at startup.
```

### 1 · `./core` — the framework-free kernel

No React runtime, no widget specifics. It holds what hosting *any* widget
requires, and the ports the host fills. Bundled into the React-17 islands, so a
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
  widget-error.ts    the render-error DOM event the island's boundary raises and the host-side renderer rethrows

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
  readonly runtimeNeeds?: readonly RuntimeNeed[];            // wc-build-actionable needs (pin:mui5-react17 | stub:node | ...)
}
```

The manifest declares no prop contract for the web component — the element takes
its props at runtime via a `setProps(obj)` method the renderer calls. The one
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

`<Widget>`, the `WidgetRenderer` interface, the renderer **registry**, the
host's setup call, and the React-19 compat / prop-mutation-safety utilities.
Host-side only — the esbuild bundle never imports it (the bundle has its own
element machinery).

```
src/mount/  (./mount barrel; renderers + compat via their own subpaths)
  Widget.tsx            the component a page renders; picks the renderer from the identity prop
  widget-renderer.ts    the WidgetRenderer union + RendererId + the two Mount prop types
  composition.ts        WidgetComposition, WidgetComposer (the mount layer's input contract)
  registry.ts           registerRenderer / getRenderer
  configure-widget-host.ts   configureWidgetHost (exported as ./host, NOT on the barrel — it pulls uicore)
  renderers/            shadow-react · web-component (generic mount factories; hosts inject
                        lazy-loading, error boundary, bundle base path)
  mutation-safe-props.ts   shallow-copy so a widget's in-place prop mutations can't reach host state
  compat/               find-dom-node · react-element-symbol · react-dom-with-find-dom-node (React-19 shims)
```

```tsx
export type RendererId = 'react-component' | 'web-component';

// Two Mount contracts on purpose: the widget's own bundle owns the manifest,
// so the web-component Mount takes only the widget's name; the shadow-react
// Mount runs the widget from its full manifest on the host React.
export interface ShadowReactRenderer {
  readonly id: 'react-component';
  readonly Mount: ComponentType<{ manifest: WidgetManifest; composition: WidgetComposition }>;
}
export interface WebComponentRenderer {
  readonly id: 'web-component';
  readonly Mount: ComponentType<{ name: string; composition: WidgetComposition }>;
}
export type WidgetRenderer = ShadowReactRenderer | WebComponentRenderer;

// The identity prop picks the renderer — no renderAs:
//   <Widget name="registration" composition={…} />      → web-component
//   <Widget manifest={extraQuestionsManifest} composition={…} /> → react-component
```

### 3 · The uicore-bound part — `src/<widget>/` + `src/lib/`

Per widget, just the `manifest` (loads the dist, declares sheets/bridges/tag) and
`vendor-styles` (its CSS). Everything else about a widget — data fetch, live-state
binding, the Client wrapper — is host integration glue and lives in the host under
its `src/widgets/catalog/<widget>/`. See this package's [README](./README.md).

### 4 · The two renderers + the host's one setup call

The generic renderer mounts ship here (`./mount/renderers/shadow-react`,
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

- **`reactComponent`** — `createShadowReactRenderer({ resolveComponent,
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
  `customElements.whenDefined`, then calls the element's
  `mount({ hostAuth, hostConfig, props })` — ports and the complete initial
  prop set in one call; later prop changes cross via `setProps(props)`. The
  bundle's shared imports (react, the exposed uicore/MUI surfaces) stay bare
  and resolve through the import map the host inlines (first in the root
  layout's body) to the generated `runtime/` chunks — the browser walks the
  module graph; there is no load ordering. The island has its own copies of
  the core ports; `mount` registers the host impls into them and configures
  the shared uicore, and the element defers shadow setup until that handshake
  has happened — the DOM element is the only host↔island channel. Render errors escaping the island
  reach the host boundary through the `widget-error` DOM event
  (`./core/widget-error`), which the island's React-17 boundary dispatches on
  the element and this renderer listens for and rethrows.

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

## The call site

The per-widget `Client.tsx` (in the host, its `src/widgets/catalog/<widget>/`) calls the
composer hook and hands the result to `<Widget>`, choosing the runtime by
identity prop — a name for the web-component runtime (no manifest import, so
the manifest graph stays out of the host bundle), or a manifest for a
host-React mount:

```tsx
import { Widget } from '@openeventkit/widgets/mount';
import { useScheduleLiteComposition } from './compose';

export default function Client({ serverProps }: { serverProps: ScheduleLiteServerProps }) {
  const composition = useScheduleLiteComposition(serverProps);
  return <Widget name="schedule-lite" composition={composition} />;
}

// Host-React variant — the only widget mounted this way today is
// extra-questions (it has no web-component build):
//   import { extraQuestionsManifest } from '@openeventkit/widgets/extra-questions/manifest';
//   <Widget manifest={extraQuestionsManifest} composition={composition} />
```
