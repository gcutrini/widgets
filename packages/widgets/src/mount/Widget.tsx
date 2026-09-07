'use client';

import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';
import { getRenderers, type WidgetRenderers } from './registry';

/**
 * Internal dispatcher behind the per-widget components (`create-widget-component`
 * builds them; consumers import `@openeventkit/widgets/<widget>/web-component`
 * or `.../react` and never render this directly). Mounts a widget by handing
 * its live composition to a renderer, chosen by which identity prop is
 * passed — the two runtimes take different identities on purpose:
 *
 * - `name`: the web-component runtime. The widget's own bundle owns the
 *   manifest; the host needs only the widget's name (custom-element tag +
 *   bundle filename).
 * - `manifest`: the react-component runtime. The widget runs on the host's
 *   React from its full manifest (dist loader, sheets, bridges).
 *
 * Renders nothing until the composition is ready.
 */
export type WidgetProps =
  | { name: string; manifest?: never; composition: WidgetComposition | null }
  | { manifest: WidgetManifest; name?: never; composition: WidgetComposition | null };

export function Widget(props: WidgetProps) {
  const { composition } = props;
  if (!composition) return null;
  if (props.name !== undefined) {
    const Mount = getRenderers().webComponent;
    if (!Mount) return missingRenderer('webComponent');
    return <Mount name={props.name} composition={composition} />;
  }
  const Mount = getRenderers().reactComponent;
  if (!Mount) return missingRenderer('reactComponent');
  return <Mount manifest={props.manifest} composition={composition} />;
}

// Loud in development (the overlay surfaces it), a warned blank in
// production — a widget region is not worth crashing a live page over.
function missingRenderer(slot: keyof WidgetRenderers): null {
  const message = `[widget-mount] no "${slot}" renderer — did the host call its widget-host registration (configureWidgetHost) before rendering widgets?`;
  if (process.env.NODE_ENV !== 'production') throw new Error(message);
  console.warn(message);
  return null;
}
