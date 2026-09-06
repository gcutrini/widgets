'use client';

import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';
import { getRenderer } from './registry';

/**
 * Mounts a widget by handing its live composition to a renderer, chosen by
 * which identity prop is passed — the two runtimes take different identities
 * on purpose:
 *
 * - `name`: the web-component runtime. The widget's own bundle owns the
 *   manifest; the host needs only the widget's name (custom-element tag +
 *   bundle filename), so the manifest graph never enters the host bundle.
 * - `manifest`: the react-component runtime. The widget runs on the host's
 *   React from its full manifest (dist loader, sheets, bridges).
 *
 * Renders nothing until the composition is ready (or if no renderer is
 * registered).
 */
export type WidgetProps =
  | { name: string; manifest?: never; composition: WidgetComposition | null }
  | { manifest: WidgetManifest; name?: never; composition: WidgetComposition | null };

export function Widget(props: WidgetProps) {
  const { composition } = props;
  const rendererId = props.name !== undefined ? 'web-component' : 'react-component';
  if (!composition) return null;
  const renderer = getRenderer(rendererId);
  if (!renderer) {
    if (process.env.NODE_ENV !== 'production') {
      // A silent blank region otherwise — usually a missing register-host
      // import (the module that registers the renderers at startup).
      console.warn(
        `[widget-mount] no renderer registered for "${rendererId}" — did the host run its renderer registration?`,
      );
    }
    return null;
  }
  // The registry is keyed by id, so the looked-up renderer's Mount matches
  // the identity prop we dispatched on; the guards let TypeScript see that.
  if (props.name !== undefined && renderer.id === 'web-component') {
    return <renderer.Mount name={props.name} composition={composition} />;
  }
  if (props.manifest !== undefined && renderer.id === 'react-component') {
    return <renderer.Mount manifest={props.manifest} composition={composition} />;
  }
  return null;
}
