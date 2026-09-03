/**
 * Web-component kit — registers a legacy widget as a custom element that runs on
 * an injected React 17 inside a shadow root, driven by the widget's shared
 * manifest.
 *
 * The shadow itself (attach + adopt sheets + font-faces + portal
 * sheets + bridges) is set up by `createWidgetShadow` — the SAME primitive the
 * app's reactComponent renderer uses — so the two renderers can't drift on any
 * of that. The kit adds only what's web-component-specific: the React-17
 * ReactDOM.render, the `setProps` prop channel, the error boundary, `wrapTree`,
 * and `elementAttrs`. There's no prop name list — the host hands over the whole
 * prop object via `setProps`.
 *
 * React/ReactDOM are injected (not imported) so the SAME kit powers both build
 * variants: `shared` (the default build) reads them from the runtime global;
 * `standalone` (`build.mjs --standalone`) bundles React 17.
 */
import { createWidgetShadow } from '@openeventkit/widget-core/widget-shadow';
import { webComponentTag } from '@openeventkit/widget-core/manifest';
import { registerHostAuth } from '@openeventkit/widget-core/host-auth';
import { registerHostConfig } from '@openeventkit/widget-core/host-config';
import { resolveWidgetComponent } from './resolve-component.js';
import { ShadowRootContext } from '@openeventkit/widgets/shadow-root-context';
import { configureUicore } from '@openeventkit/widgets/uicore-host';

// Hand this bundle's uicore the host ports — once per module graph, from the
// first element's configureHost(): the shared variant's uicore imports resolve
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
 * manifest the app's reactComponent renderer reads. The manifest is the single
 * source of a widget's dist, sheets, inline styles, bridges, and props; the
 * entry supplies only the injected React/ReactDOM.
 *
 * The widget dist loads through `manifest.load()` (the same loader the
 * reactComponent path uses), so it's bundled exactly once. Definition is async:
 * the custom element registers after the dist resolves — the renderer already
 * awaits `customElements.whenDefined`.
 *
 * @param {object} o
 * @param {any} o.React
 * @param {any} o.ReactDOM
 * @param {import('@openeventkit/widget-core/manifest').WidgetManifest} o.manifest
 * @returns {Promise<void>}
 */
export function defineWidgetWebComponent({ React, ReactDOM, manifest }) {
  return manifest.load().then((mod) =>
    defineWebComponent({
      React,
      ReactDOM,
      Component: resolveWidgetComponent(mod),
      manifest,
    }),
  );
}

/**
 * The primitive behind defineWidgetWebComponent. Internal on purpose: widgets
 * register through their manifest so the two renderers can't drift.
 *
 * The host sets the widget's props in one shot via `el.setProps(obj)` (objects,
 * functions, live data), which renders the React-17 tree with the complete set.
 *
 * @param {object} o
 * @param {any} o.React
 * @param {any} o.ReactDOM
 * @param {Function} o.Component   the widget component (resolved from its dist)
 * @param {import('@openeventkit/widget-core/manifest').WidgetManifest} o.manifest
 */
function defineWebComponent({ React, ReactDOM, Component, manifest }) {
  // Shared with the app-side renderer so the tag we register and the tag it
  // awaits can never drift.
  const tag = webComponentTag(manifest.name);
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;

  const wrapTree = manifest.wrapTree;
  const elementAttrs = manifest.elementAttrs ?? {};

  // A React-17 error boundary around the widget's OWN tree — the app's React-19
  // boundary can't see across the shadow into a different React instance. On a
  // widget render/lifecycle throw it renders nothing and reports the error out
  // through the host (`onError`), so the app can show its own fallback.
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
    constructor() {
      super();
      this._props = {};
      this._shadow = null; // WidgetShadow: { root, container, dispose }
      this._root = null; // the container <div> to render into
      this._connected = false;
      this._hostReady = false;
      // Report a widget render error out through the host as a DOM event; the
      // app-side renderer listens and raises it into its React-19 boundary.
      this._reportError = (error) => {
        this.dispatchEvent(new CustomEvent('widget-error', { detail: { error } }));
      };
    }

    /**
     * Hand the element the host's ports — the ONLY channel between the host
     * and this module graph (nothing rides window). The host calls this before
     * setProps; nothing mounts until both this and DOM connection happened,
     * because shadow setup reads HostConfig (asset URLs) and uicore needs its
     * config before the first widget render.
     */
    configureHost({ hostAuth = null, hostConfig = null } = {}) {
      registerHostAuth(hostAuth);
      registerHostConfig(hostConfig);
      configureUicoreOnce();
      this._hostReady = true;
      this._mountIfReady();
    }

    /**
     * Set the widget's props and render. The host hands the whole prop object in
     * one call, so there's no name list to maintain and no per-property write
     * burst to coalesce — the widget always renders with the complete set.
     * Merges, so repeated calls update rather than replace.
     */
    setProps(props) {
      Object.assign(this._props, props);
      this._render();
    }

    connectedCallback() {
      this._connected = true;
      this._mountIfReady();
    }

    _mountIfReady() {
      if (!this._connected || !this._hostReady) return;
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
      this._root = this._shadow.container;
      this._render();
    }

    _render() {
      // Nothing to render until the shadow is attached and the host has set
      // props (a mount with no props would crash widgets that deref data).
      if (!this._root || Object.keys(this._props).length === 0) return;
      // wrapTree adds the widget's React-context wrap (e.g. EmotionShadowProvider,
      // which scopes emotion to the shadow). It reads the shadow root from
      // ShadowRootContext, so provide that above it — the same context the
      // reactComponent renderer supplies.
      const widget = React.createElement(Component, this._props);
      const wrapped = wrapTree ? wrapTree(widget) : widget;
      ReactDOM.render(
        React.createElement(
          WidgetErrorBoundary,
          { onError: this._reportError },
          React.createElement(ShadowRootContext.Provider, { value: this._shadow.root }, wrapped),
        ),
        this._root,
      );
    }

    disconnectedCallback() {
      this._connected = false;
      if (this._root) ReactDOM.unmountComponentAtNode(this._root);
      if (this._shadow) this._shadow.dispose();
    }
  }

  customElements.define(tag, WebComponentElement);
}
