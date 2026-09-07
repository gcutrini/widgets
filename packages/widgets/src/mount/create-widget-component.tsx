'use client';

import type { ComponentType, Ref } from 'react';
import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';
import { Widget } from './Widget';

/**
 * The props every per-widget component takes: the live composition, plus an
 * optional ref that lands on the widget's host element (the custom element
 * for the web-component runtime, the shadow host for the react runtime).
 */
export interface WidgetComponentProps {
  composition: WidgetComposition | null;
  ref?: Ref<HTMLElement>;
}

/**
 * Build a widget's web-component-runtime component from its name alone. The
 * widget's own bundle owns the manifest, so a module built this way never
 * pulls the manifest graph (vendor CSS, bridges, emotion wrapping) into the
 * consumer's bundle — which runtime a widget uses is decided by which entry
 * the consumer imports (`@openeventkit/widgets/<widget>/web-component` vs
 * `@openeventkit/widgets/<widget>/react`).
 */
export function createWebComponentWidget(
  name: string,
): ComponentType<WidgetComponentProps> {
  function WebComponentWidget({ composition, ref }: WidgetComponentProps) {
    return <Widget name={name} composition={composition} ref={ref} />;
  }
  WebComponentWidget.displayName = `Widget(${name})`;
  return WebComponentWidget;
}

/**
 * Build a widget's host-React component from its full manifest (dist loader,
 * sheets, bridges). Importing a module built this way pulls the manifest
 * graph into the consumer's bundle — the price of running the widget in the
 * host's tree.
 */
export function createReactComponentWidget(
  manifest: WidgetManifest,
): ComponentType<WidgetComponentProps> {
  function ReactComponentWidget({ composition, ref }: WidgetComponentProps) {
    return <Widget manifest={manifest} composition={composition} ref={ref} />;
  }
  ReactComponentWidget.displayName = `Widget(${manifest.name})`;
  return ReactComponentWidget;
}
