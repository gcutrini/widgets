import type { ComponentType } from 'react';
import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';

export type RendererId = 'react-component' | 'web-component';

/**
 * Props for the shadow-react Mount — runs the widget on the host's React, so
 * the host supplies the full manifest (dist loader, sheets, bridges).
 */
export interface ManifestMountProps {
  manifest: WidgetManifest;
  composition: WidgetComposition;
}

/**
 * Props for the web-component Mount — the widget's own bundle owns the
 * manifest; the host passes only the widget's name (custom-element tag +
 * bundle filename), so the manifest graph never enters the host bundle.
 */
export interface WebComponentMountProps {
  name: string;
  composition: WidgetComposition;
}

/**
 * A strategy for mounting a widget. Two exist (registered by the host):
 * `reactComponent` runs the widget on the host's React 19 as a component in
 * the page's tree, from its manifest; `webComponent` runs it on its own
 * React 17 as a self-contained custom element, from its name alone. Both
 * mount into a shadow root.
 */
export interface ShadowReactRenderer {
  readonly id: 'react-component';
  readonly Mount: ComponentType<ManifestMountProps>;
}

export interface WebComponentRenderer {
  readonly id: 'web-component';
  readonly Mount: ComponentType<WebComponentMountProps>;
}

export type WidgetRenderer = ShadowReactRenderer | WebComponentRenderer;
