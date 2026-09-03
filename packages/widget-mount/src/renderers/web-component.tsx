'use client';

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  webComponentTag,
  type WidgetManifest,
} from '@openeventkit/widget-core';
import { getHostAuth, type HostAuth } from '@openeventkit/widget-core/host-auth';
import { getHostConfig, type HostConfig } from '@openeventkit/widget-core/host-config';
import { useMutationSafeProps } from '../mutation-safe-props';
import type { WidgetRenderer, WidgetMountProps } from '../WidgetRenderer';

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
 * A bundle whose registration fails inside the island (manifest.load()
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
   * Base URL path the island bundles are served from — `<name>.shared.js`
   * resolves against it. A host-serving decision, so the host must supply it.
   */
  bundleBasePath: string;
  /**
   * Error boundary around the mount. Load failures and widget render errors
   * (bridged out of the island as `widget-error` DOM events) are thrown into
   * it; without one they propagate to the nearest ancestor boundary.
   */
  Boundary?: ComponentType<{ manifest: WidgetManifest; children: ReactNode }>;
}

/**
 * Generic "run the widget as a self-contained custom element" renderer: loads
 * the shared island runtime + the widget's bundle, mirrors the host ports into
 * the runtime global before the island evaluates, and hands props across the
 * DOM boundary via the element's setProps.
 */
export function createWebComponentRenderer(
  options: WebComponentRendererOptions,
): WidgetRenderer {
  const { bundleBasePath, Boundary } = options;

  function WebComponentMount({ manifest, composition }: WidgetMountProps) {
    // Shared with the bundle's defineWebComponent so the tag we await and the
    // tag it registers can never drift.
    const tag = webComponentTag(manifest.name);
    const bundleSrc = `${bundleBasePath}/${manifest.name}.shared.js`;
    const ref = useRef<HTMLElement | null>(null);
    const [defined, setDefined] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Shallow-isolate props so a legacy widget mutating what it's handed can't
    // corrupt the host's store slices (RC-W) — the same protection the
    // shadow-react renderer applies. The widget receives the SAME prop objects
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
      const el = ref.current;
      if (!el) return;
      const onWidgetError = (e: Event) => {
        const detail = (e as CustomEvent<{ error?: unknown }>).detail;
        const err = detail?.error;
        setError(
          err instanceof Error ? err : new Error(String(err ?? 'widget error')),
        );
      };
      el.addEventListener('widget-error', onWidgetError);
      return () => el.removeEventListener('widget-error', onWidgetError);
    }, []);

    // The island has its own copies of the widget-core ports; hand it the
    // host impls through the element — the only channel between the two module
    // graphs — before the props. The element defers shadow setup and uicore
    // configuration until configureHost arrives, so ordering here is the
    // contract. Props cross in one setProps call (the element renders the
    // complete set); widget colors reach the shadow via inherited :root
    // --color_* vars, not per-element props.
    useEffect(() => {
      if (!defined) return;
      const el = ref.current as
        | (HTMLElement & {
            configureHost?: (ports: {
              hostAuth?: HostAuth | null;
              hostConfig?: HostConfig | null;
            }) => void;
            setProps?: (props: Record<string, unknown>) => void;
          })
        | null;
      if (!el) return;
      el.configureHost?.({ hostAuth: getHostAuth(), hostConfig: getHostConfig() });
      el.setProps?.(isolated);
    }, [defined, isolated]);

    // Raise any error — a runtime/bundle load failure or a widget render error
    // bridged from the kit's in-widget boundary — into the boundary, so both
    // render the same fallback. (Event-handler and async throws stay uncaught
    // here, exactly as in the shadow-react renderer.)
    if (error) throw error;

    return createElement(tag, { ref });
  }

  // Not a boundary itself: the mount THROWS load/render errors (see above), so
  // it must sit under one — this wraps it in the host's Boundary when given.
  function BoundedWebComponentMount({ manifest, composition }: WidgetMountProps) {
    const mounted = (
      <WebComponentMount manifest={manifest} composition={composition} />
    );
    return Boundary ? (
      <Boundary manifest={manifest}>{mounted}</Boundary>
    ) : (
      mounted
    );
  }

  return {
    id: 'web-component',
    Mount: BoundedWebComponentMount,
  };
}
