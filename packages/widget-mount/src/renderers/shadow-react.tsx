'use client';

// React-19 compat for legacy widget bundles — must run before any widget code.
import '../compat/find-dom-node';
import '../compat/react-element-symbol';

import {
  createElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createWidgetShadow,
  type WidgetManifest,
  type WidgetShadow,
} from '@openeventkit/widget-core';
import { useMutationSafeProps } from '../mutation-safe-props';
import type { WidgetRenderer, WidgetMountProps } from '../WidgetRenderer';

// Attach the shadow before paint so the raw host element never flashes; fall
// back to useEffect on a server render pass (client components still render
// once on the server).
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface ShadowReactRendererOptions {
  /**
   * Turn a manifest into the widget's React component. The host decides how
   * the lazy load happens (e.g. Next's `dynamic(manifest.load, { ssr: false })`
   * or `React.lazy`); called once per mount and memoized on the manifest.
   */
  resolveComponent: (
    manifest: WidgetManifest,
  ) => ComponentType<Record<string, unknown>>;
  /**
   * Wrap the widget tree rendered inside the shadow root — e.g. provide a
   * shadow-root context the widget kit reads. Identity by default.
   */
  wrapShadowTree?: (tree: ReactNode, shadowRoot: ShadowRoot) => ReactNode;
  /**
   * Error boundary around the whole mount (host element included). The host
   * supplies its reporting stack and fallback UI; without one, render errors
   * propagate to the nearest ancestor boundary.
   */
  Boundary?: ComponentType<{ manifest: WidgetManifest; children: ReactNode }>;
}

/**
 * Generic "run the widget on the host's React" renderer: mounts the widget
 * into a `createWidgetShadow` host via a portal, with mutation-safe props.
 * Everything host-specific (lazy loading, error reporting, shadow context)
 * is injected through the options.
 */
export function createShadowReactRenderer(
  options: ShadowReactRendererOptions,
): WidgetRenderer {
  const { resolveComponent, wrapShadowTree, Boundary } = options;

  function ShadowReactMount({ manifest, composition }: WidgetMountProps) {
    const hostRef = useRef<HTMLElement | null>(null);
    const [shadow, setShadow] = useState<WidgetShadow | null>(null);

    // One component per manifest — resolution (and any lazy-load setup) runs
    // once per mount.
    const LegacyWidget = useMemo(
      () => resolveComponent(manifest),
      [manifest],
    );

    // Hand the widget shallow copies so its in-place prop mutations can't
    // reach the host's store slices / server props (RC-W).
    const isolated = useMutationSafeProps(composition.props);

    useIsomorphicLayoutEffect(() => {
      const host = hostRef.current;
      if (!host || host.shadowRoot) return;
      const prepared = createWidgetShadow(host, manifest);
      setShadow(prepared);
      return () => prepared.dispose();
      // Manifest is stable per widget; capture the initial value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tree = useMemo(() => {
      const widget = <LegacyWidget {...isolated} />;
      return manifest.wrapTree ? manifest.wrapTree(widget) : widget;
    }, [LegacyWidget, isolated, manifest]);

    const mounted = createElement(
      manifest.elementTag ?? 'div',
      { ref: hostRef, ...manifest.elementAttrs },
      shadow
        ? createPortal(
            wrapShadowTree ? wrapShadowTree(tree, shadow.root) : tree,
            shadow.container,
          )
        : null,
    );

    return Boundary ? (
      <Boundary manifest={manifest}>{mounted}</Boundary>
    ) : (
      mounted
    );
  }

  return {
    id: 'react-component',
    Mount: ShadowReactMount,
  };
}
