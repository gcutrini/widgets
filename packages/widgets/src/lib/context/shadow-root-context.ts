'use client';

import { createContext, useContext } from 'react';

/**
 * The nearest ancestor widget shadow root — provided by the reactComponent
 * renderer around the widget it portals into a `createWidgetShadow`.
 * Descendants call `useShadowRoot()` to grab it (e.g. to point an emotion
 * `CacheProvider` at the correct container — see `EmotionShadowProvider`).
 *
 * Pattern lifted from `react-shadow`'s `utils.Context`, which underpins
 * their `<root.emotion.div>` auto-wire.
 */
export const ShadowRootContext = createContext<ShadowRoot | null>(null);

/**
 * Returns the shadow root the current React tree is portaled into, or
 * `null` if there is no `ShadowRootContext` above. Safe to call from any
 * client component rendered inside a widget's shadow root.
 */
export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}
