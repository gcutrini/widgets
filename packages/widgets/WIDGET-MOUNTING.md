# Widget mounting — one contract, two renderers

This document is the contract a host implements to mount the legacy widgets: a
widget is **declared once** (`manifest`), **composed once** (`compose`), and
**rendered by a swappable renderer** (`<Widget renderAs>`) — `reactComponent`
(the host's React 19, in the page's tree) or `webComponent` (its own bundled
React 17, as a self-contained custom element). Host file paths below are the
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
  or its own bundled React 17 (a self-contained custom element). *The only axis
  that actually differs between the two renderers.*

Separating them means the first two are written **once** and the third is a
**one-prop swap** (`renderAs`).

---

## The vocabulary

| Name | Role | Reads as |
|---|---|---|
| `WidgetManifest` | static declaration | "what this widget is + needs" |
| `WidgetComposer` → `WidgetComposition` | live-data binding | "its realtime + auth + callbacks, per render" |
| `WidgetShadow` | shared shadow-DOM primitive | "the shadow the widget renders into" |
| `WidgetBridge` | host-agnostic DOM fix-up | "a shadow patch: emotion-mirror, click-outside…" |
| `<Widget renderAs={…}>` | the component a page renders | "put a widget on the page" |
| `WidgetRenderer` (`renderAs`) | how it runs | `'react-component'` (host React) or `'web-component'` (own React) |

---

## The homes

Dependencies flow one way. uicore is contained in `@openeventkit/widgets`; the
esbuild bundle pulls only framework-free code.

```
@openeventkit/widget-core   framework-free kernel — imported by BOTH the host and the esbuild build.
   ▲                        WidgetManifest type (incl. WidgetBridge), createWidgetShadow, + host ports.
@openeventkit/widget-mount   React mount contract — <Widget>, WidgetRenderer, the renderer registry,
   ▲                         and the React-19 compat / prop-mutation-safety utilities. Host-side only.
@openeventkit/widgets        the uicore-bound part of each widget: manifest + vendor-styles.
   ▲                         (integration glue — compose/Client/index — lives in the host, src/widgets/<w>.)
HOST (separate repo) src/components/widget/renderers/   the two concrete renderers;
                                   registered into widget-mount at startup.
```

### 1 · `@openeventkit/widget-core` — the framework-free kernel

No React runtime, no widget specifics. It holds what hosting *any* widget
requires, and the ports the host fills.

```
@openeventkit/widget-core/
  manifest.ts        WidgetManifest, WidgetBridge, WidgetComponent   (types)
  widget-shadow.ts   createWidgetShadow() → WidgetShadow             (the one shadow primitive)
  vendor-sheet.ts    VendorSheet
  host-auth.ts       HostAuth port — session presence + logout the host registers
  host-config.ts     HostConfig port — apiBaseUrl / idpBaseUrl / oauth2ClientId / timeApiUrl the host registers
  widget-auth-error.ts   the 401/403 DOM event the injected uicore auth handler raises and the host dialog handles
  widget-notify.ts   the notification DOM event the sweetalert2 shim raises and the host dialog handles

@openeventkit/widgets/src/kit/bridges/   (implementations of the WidgetBridge contract)
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
  readonly container: HTMLElement;   // the <div> inside the shadow to render the widget's React tree into
  dispose(): void;                   // tear down bridges + adopted styles
}
export function createWidgetShadow(
  host: HTMLElement,
  manifest: WidgetManifest,
): WidgetShadow;
```

### 2 · `@openeventkit/widget-mount` — the mount contract

`<Widget>`, the `WidgetRenderer` interface, the renderer **registry**, and the
React-19 compat / prop-mutation-safety utilities. Host-side only — the esbuild
bundle never imports it (the bundle has its own kit).

```
@openeventkit/widget-mount/
  Widget.tsx            the component a page renders; resolves renderAs via the registry
  WidgetRenderer.ts     the WidgetRenderer interface + RendererId + WidgetMountProps
  composition.ts        WidgetComposition, WidgetComposer (the mount layer's input contract)
  registry.ts           registerRenderer / getRenderer
  renderers/            shadow-react · web-component (generic mount factories; hosts inject
                        lazy-loading, error boundary, shadow context, bundle base path)
  mutation-safe-props.ts   shallow-copy so a widget's in-place prop mutations can't reach host state
  compat/               find-dom-node · react-element-symbol · react-dom-with-find-dom-node (React-19 shims)
```

```tsx
export type RendererId = 'react-component' | 'web-component';

export interface WidgetRenderer {
  readonly id: RendererId;
  readonly Mount: ComponentType<{ manifest: WidgetManifest; composition: WidgetComposition }>;
}

export function Widget({ manifest, composition, renderAs }: {
  manifest: WidgetManifest;
  composition: WidgetComposition | null;
  renderAs: RendererId;
}) {
  if (!composition) return null;
  const renderer = getRenderer(renderAs);   // filled by the host at startup
  if (!renderer) return null;
  return <renderer.Mount manifest={manifest} composition={composition} />;
}
```

### 3 · `@openeventkit/widgets` — the uicore-bound part

Per widget, just the `manifest` (loads the dist, declares sheets/bridges/tag) and
`vendor-styles` (its CSS). Everything else about a widget — data fetch, live-state
binding, the Client wrapper — is host integration glue and lives in the host under
its `src/widgets/<widget>/`. See this package's [README](./README.md).

### 4 · The two renderers — host code (`src/components/widget/renderers/` in the reference host)

The concrete renderers are Next/Sentry/uicore-coupled, so they live in the host.
Its `register-host.ts` (imported in `Providers`) registers them into the
widget-mount registry once at startup:

- **`reactComponent`** — `createWidgetShadow(ref, manifest)`, then
  renders `next/dynamic(manifest.load, {ssr:false})` into `container` on the
  host's React 19, wrapped by `manifest.wrapTree`. widget-mount's shadow-react
  factory side-effect-imports the React-19 compat shims (`find-dom-node`,
  `react-element-symbol`); the host wrapper adds `compat/uicore-i18n`.
- **`webComponent`** — loads `${manifest.name}.shared.js` as an ES module,
  awaits `customElements.whenDefined`, then calls the element's
  `configureHost({ hostAuth, hostConfig })` followed by
  `setProps(composition.props)`. The bundle's shared imports (react, the
  exposed uicore/MUI surfaces) stay bare and resolve through the import map
  the host inlines (`WidgetImportMap`, first in the root layout's body) to the
  generated `runtime/` chunks — the browser walks the module graph; there is
  no load ordering. The island has its own copies of the widget-core ports;
  `configureHost` registers the host impls into them and configures the
  shared uicore, and the element defers shadow setup until that handshake
  has happened — the DOM element is the only host↔island channel.

The same `register-host.ts` fills the HostConfig port (proxy base + IDP settings)
and the HostAuth port (session presence + logout, from the reference host's
`src/lib/auth/session-token.ts`), then calls `configureUicore()` from
`@openeventkit/widgets/uicore-host`, which hands uicore its config, token
resolver and auth handlers. The resolver and handlers read the ports at call
time.

---

## The composer

The composer runs in the **host's React 19** for both renderers — the
web-component can't run host hooks inside its own React, so live state is always
bound host-side and handed across the boundary. Composers live with the rest of
the integration glue in the host's `src/widgets/<widget>/compose.ts`.

```ts
export interface WidgetComposition {
  readonly props: Record<string, unknown>;
}
// A use-prefixed hook: it binds live state and needs the widget's server-derived props.
export type WidgetComposer<TServerProps = void> =
  (serverProps: TServerProps) => WidgetComposition | null;   // null = required data not ready
```

## The call site

The per-widget `Client.tsx` (in the host, its `src/widgets/<widget>/`) calls the
composer hook and hands the result to `<Widget>`, choosing the renderer by id:

```tsx
import { Widget } from '@openeventkit/widget-mount';
import { scheduleLiteManifest } from '@openeventkit/widgets/schedule-lite/manifest';
import { useScheduleLiteComposition } from './compose';

export default function Client({
  serverProps,
  renderAs = 'react-component',   // ← 'web-component' swaps in with no other change
}: {
  serverProps: ScheduleLiteServerProps;
  renderAs?: 'react-component' | 'web-component';
}) {
  const composition = useScheduleLiteComposition(serverProps);
  return <Widget manifest={scheduleLiteManifest} composition={composition} renderAs={renderAs} />;
}
```
