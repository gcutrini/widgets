'use client';

import type { WidgetManifest } from '@openeventkit/widget-core';
import type { WidgetComposition } from './composition';
import { getRenderer } from './registry';
import type { RendererId } from './WidgetRenderer';

/**
 * Mounts a widget by handing its manifest + live composition to the renderer
 * registered under `renderAs`. Renders nothing until the composition is ready
 * (or if no renderer is registered). Swapping `renderAs` between
 * 'react-component' and 'web-component' is the only change needed to move a
 * widget between runtimes.
 */
export function Widget({
  manifest,
  composition,
  renderAs,
}: {
  manifest: WidgetManifest;
  composition: WidgetComposition | null;
  renderAs: RendererId;
}) {
  if (!composition) return null;
  const renderer = getRenderer(renderAs);
  if (!renderer) {
    if (process.env.NODE_ENV !== 'production') {
      // A silent blank region otherwise — usually a missing register-host
      // import (the module that registers the renderers at startup).
      console.warn(
        `[widget-mount] no renderer registered for "${renderAs}" — did the host run its renderer registration?`,
      );
    }
    return null;
  }
  const { Mount } = renderer;
  return <Mount manifest={manifest} composition={composition} />;
}
