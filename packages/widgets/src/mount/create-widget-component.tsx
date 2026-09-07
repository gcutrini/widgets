'use client';

import type { ComponentType } from 'react';
import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';
import { Widget } from './Widget';

/** The props every per-widget component takes: just the live composition. */
export interface WidgetComponentProps {
  composition: WidgetComposition | null;
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
  function WebComponentWidget({ composition }: WidgetComponentProps) {
    return <Widget name={name} composition={composition} />;
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
export function createManifestWidget(
  manifest: WidgetManifest,
): ComponentType<WidgetComponentProps> {
  function ManifestWidget({ composition }: WidgetComponentProps) {
    return <Widget manifest={manifest} composition={composition} />;
  }
  ManifestWidget.displayName = `Widget(${manifest.name})`;
  return ManifestWidget;
}
