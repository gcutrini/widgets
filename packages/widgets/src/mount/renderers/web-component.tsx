'use client';

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { webComponentTag } from '../../core';
import { getHostAuth, type HostAuth } from '../../core/host-auth';
import { getHostConfig, type HostConfig } from '../../core/host-config';
import { useMutationSafeProps } from '../mutation-safe-props';
import { useHostRef } from '../use-host-ref';
import { WIDGET_ERROR_EVENT } from '../../core/widget-error';
import type { WebComponentMountProps } from '../mount-props';

/** The element's host-facing surface (defined by the widget's bundle). */
type WidgetElement = HTMLElement & {
  mount?: (args: {
    hostAuth?: HostAuth | null;
    hostConfig?: HostConfig | null;
    props?: Record<string, unknown>;
  }) => void;
  setProps?: (props: Record<string, unknown>) => void;
  unmount?: () => void;
};

/**
 * Load a module <script> once per src, shared across every mount. The bundle
 * is an ES module whose bare imports (react, the shared uicore/MUI surfaces)
 * the browser resolves through the import map the HOST inlined in its
 * document (first in body, ahead of any widget module) — no runtime-chunk
 * ordering exists; the module graph pulls what it needs.
 */
const scriptLoads = new Map<string, Promise<void>>();

function loadModuleOnce(src: string): Promise<void> {
  let load = scriptLoads.get(src);
  if (!load) {
    load = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.type = 'module';
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`failed to load ${src}`));
      document.head.appendChild(el);
    });
    scriptLoads.set(src, load);
  }
  return load;
}

/**
 * A bundle whose registration fails during evaluation (manifest.load()
 * rejects, defineWebComponent throws) never defines the element, and
 * `customElements.whenDefined` would pend forever — a blank widget with no
 * error. Race it against a generous timeout so that failure reaches the
 * boundary like every other one. Generous on purpose: the bundle script
 * itself has already loaded by this point, so only registration work remains.
 */
const DEFINE_TIMEOUT_MS = 20_000;

function whenDefinedOrTimeout(tag: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    customElements.whenDefined(tag).then(() => undefined),
    new Promise<void>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `custom element <${tag}> was not defined within ${DEFINE_TIMEOUT_MS}ms — its bundle likely failed during registration`,
            ),
          ),
        DEFINE_TIMEOUT_MS,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export interface WebComponentRendererOptions {
  /**
   * Base URL path the widget bundles are served from — `<name>.shared.js`
   * resolves against it. A host-serving decision, so the host must supply it.
   */
  bundleBasePath: string;
  /**
   * Error boundary around the mount. Load failures and widget render errors
   * (bridged out of the element as `widget-error` DOM events) are thrown into
   * it; without one they propagate to the nearest ancestor boundary.
   */
  Boundary?: ComponentType<{ name: string; children: ReactNode }>;
}

/**
 * Generic "run the widget as a self-contained custom element" renderer: loads
 * the shared runtime + the widget's bundle, then drives the element's visit
 * lifecycle across the DOM boundary — mount() with the ports and initial
 * props, setProps() for updates, unmount() when this mount goes away.
 */
export function createWebComponentRenderer(
  options: WebComponentRendererOptions,
): ComponentType<WebComponentMountProps> {
  const { bundleBasePath, Boundary } = options;

  function WebComponentMount({ name, composition, ref: forwardedRef }: WebComponentMountProps) {
    // Shared with the bundle's defineWebComponent so the tag we await and the
    // tag it registers can never drift. The name is the whole host-side
    // identity — the widget's own bundle owns the manifest.
    const tag = webComponentTag(name);
    const bundleSrc = `${bundleBasePath}/${name}.shared.js`;
    const { ref: elementRef, setRef: setHostRef } = useHostRef<WidgetElement>(forwardedRef);
    const [defined, setDefined] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Shallow-isolate props so a legacy widget mutating what it's handed can't
    // corrupt the host's store slices (RC-W) — the same protection the
    // react-component renderer applies. The widget receives the SAME prop objects
    // across the DOM boundary, so the mutation risk is identical here.
    const isolated = useMutationSafeProps(composition.props);

    useEffect(() => {
      let cancelled = false;
      loadModuleOnce(bundleSrc)
        .then(() => whenDefinedOrTimeout(tag))
        .then(() => {
          if (!cancelled) setDefined(true);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        });
      return () => {
        cancelled = true;
      };
    }, [bundleSrc, tag]);

    // The widget runs on its own React across the shadow boundary, so the
    // host's boundary can't catch its render errors directly. The kit's
    // in-widget boundary reports them out as a `widget-error` DOM event; raise
    // it here so the same boundary + fallback handle it. Attached on mount,
    // long before the async bundle load lets the widget first render.
    useEffect(() => {
      const el = elementRef.current;
      if (!el) return;
      const onWidgetError = (e: Event) => {
        const detail = (e as CustomEvent<{ error?: unknown }>).detail;
        const err = detail?.error;
        setError(
          err instanceof Error ? err : new Error(String(err ?? 'widget error')),
        );
      };
      el.addEventListener(WIDGET_ERROR_EVENT, onWidgetError);
      return () => el.removeEventListener(WIDGET_ERROR_EVENT, onWidgetError);
    }, []);

    // Current props for the visit-lifecycle effect to read at mount time —
    // its deps are [defined] on purpose, so a plain closure would go stale.
    const propsRef = useRef(isolated);
    propsRef.current = isolated;
    // The prop bag the element already holds, so the update effect can skip
    // the one mount() just delivered.
    const sentRef = useRef<Record<string, unknown> | null>(null);

    // The visit lifecycle. The widget's bundle has its own copies of the widget-core
    // ports; hand it the host impls through the element — the only channel
    // between the two module graphs — together with the complete initial prop
    // set in one mount() call. The cleanup ends the visit: it runs on real
    // unmount AND when the router hides this page in an <Activity> boundary
    // (which keeps the DOM connected, so the element's disconnectedCallback
    // never fires there) — the element unmounts its React tree either way,
    // and the effect re-running on return opens a fresh visit with the
    // current props.
    useEffect(() => {
      if (!defined) return;
      const el = elementRef.current;
      if (!el) return;
      sentRef.current = propsRef.current;
      el.mount?.({
        hostAuth: getHostAuth(),
        hostConfig: getHostConfig(),
        props: propsRef.current,
      });
      return () => {
        sentRef.current = null;
        el.unmount?.();
      };
    }, [defined]);

    // Prop updates while the visit is open. setProps replaces the whole bag
    // (React semantics); widget colors reach the shadow via inherited :root
    // --color_* vars, not per-element props.
    useEffect(() => {
      if (!defined || sentRef.current === isolated) return;
      sentRef.current = isolated;
      elementRef.current?.setProps?.(isolated);
    }, [defined, isolated]);

    // Raise any error — a runtime/bundle load failure or a widget render error
    // bridged from the kit's in-widget boundary — into the boundary, so both
    // render the same fallback. (Event-handler and async throws stay uncaught
    // here, exactly as in the react-component renderer.)
    if (error) throw error;

    return createElement(tag, { ref: setHostRef });
  }

  // Not a boundary itself: the mount THROWS load/render errors (see above), so
  // it must sit under one — this wraps it in the host's Boundary when given.
  function BoundedWebComponentMount({ name, composition, ref }: WebComponentMountProps) {
    const mounted = (
      <WebComponentMount name={name} composition={composition} ref={ref} />
    );
    return Boundary ? <Boundary name={name}>{mounted}</Boundary> : mounted;
  }

  return BoundedWebComponentMount;
}
