import type { ComponentType } from 'react';
import type { ManifestMountProps, WebComponentMountProps } from './widget-renderer';

/**
 * The two ways a widget can mount — the host supplies both at setup
 * (configureWidgetHost) and the per-widget components read them here at
 * render time. This is the seam that lets widget definitions stay free of
 * the host's (Next/Sentry-coupled) mount implementations.
 */
export interface WidgetRenderers {
  /** Runs the widget on the host's React from its manifest. */
  reactComponent?: ComponentType<ManifestMountProps>;
  /** Runs the widget as a self-contained custom element from its name. */
  webComponent?: ComponentType<WebComponentMountProps>;
}

let renderers: WidgetRenderers = {};

export function setRenderers(r: WidgetRenderers): void {
  renderers = r;
}

export function getRenderers(): WidgetRenderers {
  return renderers;
}
