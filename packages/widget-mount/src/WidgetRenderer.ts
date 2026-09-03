import type { ComponentType } from 'react';
import type { WidgetManifest } from '@openeventkit/widget-core';
import type { WidgetComposition } from './composition';

export type RendererId = 'react-component' | 'web-component';

/** The props every renderer Mount receives. */
export interface WidgetMountProps {
  manifest: WidgetManifest;
  composition: WidgetComposition;
}

/**
 * A strategy for mounting a widget. Two exist (registered by the app):
 * `reactComponent` runs the widget on the app's React 19 as a component in the
 * page's tree; `webComponent` runs it on its own React 17 as a self-contained
 * custom element. Both mount into a shadow root and take the same manifest +
 * composition.
 */
export interface WidgetRenderer {
  readonly id: RendererId;
  readonly Mount: ComponentType<WidgetMountProps>;
}
