/**
 * Web-component kit — registers a legacy widget as a custom element that runs on
 * an injected React 18 root inside a shadow root, driven by the widget's
 * shared manifest.
 *
 * The shadow itself (attach + adopt sheets + font-faces + portal
 * sheets + bridges) is set up by `createWidgetShadow` — the SAME primitive the
 * host's reactComponent renderer uses — so the two renderers can't drift on any
 * of that. The kit adds only what's web-component-specific: the React-18
 * root per connected span, the `mount`/`setProps`/`unmount` visit lifecycle,
 * the error boundary, `wrapTree`, and `elementAttrs`. There's no prop name list — the host
 * hands over the whole prop object (`mount` opens the visit, `setProps` replaces
 * while it's open, `unmount` closes it).
 *
 * React/createRoot are injected (not imported) so the SAME kit powers both
 * build variants: `shared` (the default build) resolves them through the
 * import map; `standalone` (`build.mjs --standalone`) bundles React 18.
 */
import { createWidgetShadow } from '@openeventkit/widgets/core/widget-shadow';
import { webComponentTag } from '@openeventkit/widgets/core/manifest';
import { registerHostAuth } from '@openeventkit/widgets/core/host-auth';
import { registerHostConfig } from '@openeventkit/widgets/core/host-config';
import { WIDGET_ERROR_EVENT } from '@openeventkit/widgets/core/widget-error';
import { WIDGET_PAINTED_EVENT } from '@openeventkit/widgets/core/widget-painted';
import { resolveWidgetComponent } from './resolveWidgetComponent.js';
import { ShadowRootContext } from '@openeventkit/widgets/shadow-root-context';
import { configureUicore } from '@openeventkit/widgets/uicore-host';

// Hand this bundle's uicore the host ports — once per module graph, from the
// first element's mount(): the shared variant's uicore imports resolve
// to the shared import-map chunks (so this configures the shared instance),
// and the standalone variant configures its bundled copy.
let uicoreConfigured = false;
function configureUicoreOnce() {
  if (uicoreConfigured) return;
  uicoreConfigured = true;
  configureUicore();
}

/**
 * Register a widget as a web component from its shared WidgetManifest — the SAME
 * manifest the host's reactComponent renderer reads. The manifest is the single
 * source of a widget's dist, sheets, inline styles, bridges, and props; the
 * entry supplies only the injected React/createRoot.
 *
 * The widget dist loads through `manifest.load()` (the same loader the
 * reactComponent path uses), so it's bundled exactly once. Definition is async:
 * the custom element registers after the dist resolves — the renderer already
 * awaits `customElements.whenDefined`.
 *
 * @param {object} o
 * @param {any} o.React
 * @param {any} o.createRoot   react-dom/client's createRoot
 * @param {import('@openeventkit/widgets/core/manifest').WidgetManifest} o.manifest
 * @returns {Promise<void>}
 */
export function defineWidgetWebComponent({ React, createRoot, manifest }) {
  return manifest.load().then((mod) =>
    defineWebComponent({
      React,
      createRoot,
      Component: resolveWidgetComponent(mod),
      manifest,
    }),
  );
}

/**
 * The primitive behind defineWidgetWebComponent. Internal on purpose: widgets
 * register through their manifest so the two renderers can't drift.
 *
 * The host hands the ports and the widget's props in one shot via
 * `el.mount({ hostAuth, hostConfig, props })` (objects, functions, live data),
 * which renders the widget's React tree with the complete set; later updates go
 * through `el.setProps(obj)`, and `el.unmount()` closes the visit.
 *
 * @param {object} o
 * @param {any} o.React
 * @param {any} o.createRoot
 * @param {Function} o.Component   the widget component (resolved from its dist)
 * @param {import('@openeventkit/widgets/core/manifest').WidgetManifest} o.manifest
 */
function defineWebComponent({ React, createRoot, Component, manifest }) {
  // Shared with the host-side renderer so the tag we register and the tag it
  // awaits can never drift.
  const tag = webComponentTag(manifest.name);
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;

  const wrapTree = manifest.wrapTree;
  const elementAttrs = manifest.elementAttrs ?? {};

  // A bundle-side React error boundary around the widget's OWN tree — the host's React-19
  // boundary can't see across the shadow into a different React instance. On a
  // widget render/lifecycle throw it renders nothing and reports the error out
  // through the host (`onError`), so the host can show its own fallback.
  // Announces the tree's first commit — the root-API analog of legacy
  // render's completion callback. Sits BELOW the error boundary: a throwing
  // first render unwinds before this subtree commits, so its effect never
  // runs and a failed first render announces nothing.
  function FirstCommitSignal({ onCommit, children }) {
    React.useLayoutEffect(() => {
      onCommit();
    }, []);
    return children;
  }

  class WidgetErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { failed: false };
    }
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(error, info) {
      this.props.onError(error, info);
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  class WebComponentElement extends HTMLElement {
    // Two lifecycles, deliberately separate:
    //   visit (host-driven, React semantics): mount() opens it, setProps()
    //     REPLACES props while it's open, unmount() closes it.
    //   DOM (safety net): connectedCallback renders if a visit is open;
    //     disconnectedCallback tears the tree down but KEEPS the visit, so a
    //     same-tick reparent (a React list reorder) reconnects with state and
    //     a standalone host that only removes the node still gets cleanup.
    constructor() {
      super();
      this._props = null; // null = no open visit (DOM connection comes from the element's own isConnected)
      this._shadow = null; // WidgetShadow: { root, container, dispose } — permanent once created (attachShadow is one-way)
      this._painted = false; // first-commit-of-visit announced?
      this._root = null; // React root for the current connected span of the visit
      // Report a widget render error out through the host as a DOM event; the
      // app-side renderer listens and raises it into its React-19 boundary.
      this._reportError = (error) => {
        this.dispatchEvent(new CustomEvent(WIDGET_ERROR_EVENT, { detail: { error } }));
      };
      // Announce the visit's first commit one frame later, when the browser
      // has painted it. Once per visit — mount() resets the flag; a
      // reconnect's fresh root re-commits and the flag absorbs it.
      this._announcePaint = () => {
        if (this._painted) return;
        this._painted = true;
        requestAnimationFrame(() => {
          this.dispatchEvent(new CustomEvent(WIDGET_PAINTED_EVENT, { bubbles: true }));
        });
      };
    }

    /**
     * Open a visit: the ports — the ONLY channel between the host and this
     * module graph (nothing rides window) — and the initial props, in one
     * shot. Nothing renders until both this and DOM connection happened,
     * because shadow setup reads HostConfig (asset URLs) and uicore needs its
     * config before the first widget render. Later prop updates go through
     * setProps; unmount() closes the visit.
     */
    mount({ hostAuth = null, hostConfig = null, props = {} } = {}) {
      registerHostAuth(hostAuth);
      registerHostConfig(hostConfig);
      configureUicoreOnce();
      this._props = { ...props };
      this._painted = false;
      this._renderIfReady();
    }

    /**
     * Replace the widget's props and render — React semantics: the host hands
     * the complete prop object each call; a key absent from it is gone. No-op
     * outside an open visit.
     */
    setProps(props) {
      if (this._props === null) return;
      this._props = { ...props };
      this._render();
    }

    /**
     * Close the visit: unmount the React tree (running the widget's effect
     * cleanups — how a widget resets its own state on exit) and dispose the
     * bridges. The shadow root stays attached — attachShadow can't run twice —
     * and a later mount() renders a fresh tree into it. Idempotent, including
     * after disconnectedCallback already tore the tree down.
     */
    unmount() {
      this._props = null;
      this._teardown();
    }

    connectedCallback() {
      this._renderIfReady();
    }

    _renderIfReady() {
      if (!this.isConnected || this._props === null) return;
      if (this._shadow) {
        // Reconnect after a disconnect (the host moved the element in the DOM):
        // disconnectedCallback disposed the bridges, so restart them before
        // rendering into the existing shadow.
        this._shadow.connectBridges();
        this._render();
        return;
      }
      for (const [name, value] of Object.entries(elementAttrs)) {
        this.setAttribute(name, value);
      }
      // The one shared shadow-setup primitive — identical to the reactComponent
      // path (cascade order, fonts, portal sheets, bridges). Widget colors reach
      // the shadow via inherited :root --color_* vars.
      this._shadow = createWidgetShadow(this, manifest);
      this._render();
    }

    _render() {
      // Nothing to render until the shadow is attached and a visit is open.
      if (!this._shadow || this._props === null) return;
      // wrapTree adds the widget's React-context wrap (e.g. EmotionShadowProvider,
      // which scopes emotion to the shadow). It reads the shadow root from
      // ShadowRootContext, so provide that above it — the same context the
      // reactComponent renderer supplies.
      const widget = React.createElement(Component, this._props);
      const wrapped = wrapTree ? wrapTree(widget) : widget;
      // One root per connected span: created lazily on the first render after
      // a mount or a reconnect (an unmounted React 18 root cannot be reused).
      this._root ??= createRoot(this._shadow.container);
      this._root.render(
        React.createElement(
          WidgetErrorBoundary,
          { onError: this._reportError },
          React.createElement(
            FirstCommitSignal,
            { onCommit: this._announcePaint },
            React.createElement(ShadowRootContext.Provider, { value: this._shadow.root }, wrapped),
          ),
        ),
      );
    }

    // Shared by unmount() and disconnectedCallback — the two run back-to-back
    // when React removes the element (DOM removal first, effect cleanup
    // after), so the root guard makes the second call a no-op.
    _teardown() {
      if (this._root) {
        this._root.unmount();
        this._root = null;
      }
      if (this._shadow) this._shadow.dispose();
    }

    disconnectedCallback() {
      this._teardown();
    }
  }

  customElements.define(tag, WebComponentElement);
}
