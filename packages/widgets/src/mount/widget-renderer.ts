import type { Ref } from 'react';
import type { WidgetManifest } from '../core';
import type { WidgetComposition } from './composition';

/**
 * Props for the react-component mount — runs the widget on the host's React,
 * so the host supplies the full manifest (dist loader, sheets, bridges).
 */
export interface ManifestMountProps {
  manifest: WidgetManifest;
  composition: WidgetComposition;
  /** Forwarded to the shadow host element. */
  ref?: Ref<HTMLElement>;
}

/**
 * Props for the web-component mount — the widget's own bundle owns the
 * manifest; the host passes only the widget's name (custom-element tag +
 * bundle filename).
 */
export interface WebComponentMountProps {
  name: string;
  composition: WidgetComposition;
  /** Forwarded to the custom element. */
  ref?: Ref<HTMLElement>;
}
