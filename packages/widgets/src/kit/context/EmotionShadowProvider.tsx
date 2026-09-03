'use client';

import { useMemo, type ReactNode } from 'react';
import { CacheProvider, type EmotionCache } from '@emotion/react';
import createCache from '@emotion/cache';
import { useShadowRoot } from './shadow-root-context';

interface EmotionShadowProviderProps {
  /**
   * Prefix for emotion's generated class names — must be unique per
   * widget module (`w-registration`, `w-schedule`, etc.) to avoid
   * hash collisions when multiple widgets share a page.
   */
  cacheKey: string;
  children: ReactNode;
}

/**
 * Points emotion's runtime CSS injection at the enclosing shadow root
 * instead of `document.head`. Any widget that uses MUI (or another
 * emotion-based library) internally must be wrapped in this so
 * `<Autocomplete>`, `<Popover>`, etc. render styled inside shadow scope.
 *
 * Pattern lifted from `react-shadow/emotion` — same WeakMap-per-root
 * cache reuse so re-renders don't churn caches.
 *
 * Every rule is ALSO reflected into a `document.head` style tag: MUI
 * renders poppers/modals/drawers through portals into `document.body`,
 * outside the shadow root, where shadow-scoped styles can't reach
 * (unstyled Autocomplete dropdowns, bare dialogs). Emotion class names
 * are content-hashed and globally unique, so the head copy can't collide
 * with anything — it just makes the same selectors resolve for portaled
 * markup.
 */
const cacheByRoot = new WeakMap<ShadowRoot, EmotionCache>();

function reflectIntoHead(cache: EmotionCache, cacheKey: string): void {
  const reflect = document.createElement('style');
  reflect.setAttribute('data-emotion-reflect', cacheKey);
  document.head.appendChild(reflect);
  const origInsert = cache.sheet.insert.bind(cache.sheet);
  cache.sheet.insert = (rule: string) => {
    origInsert(rule);
    try {
      reflect.sheet?.insertRule(rule, reflect.sheet.cssRules.length);
    } catch {
      // insertRule throws on rules this engine can't parse (other
      // vendors' prefixes) — such a rule wouldn't apply here anyway.
    }
  };
}

export function EmotionShadowProvider({ cacheKey, children }: EmotionShadowProviderProps) {
  const root = useShadowRoot();
  const cache = useMemo(() => {
    if (!root) return null;
    const existing = cacheByRoot.get(root);
    if (existing) return existing;
    const created = createCache({
      key: cacheKey,
      container: root as unknown as HTMLElement,
      prepend: true,
    });
    reflectIntoHead(created, cacheKey);
    cacheByRoot.set(root, created);
    return created;
  }, [root, cacheKey]);

  if (!root || !cache) {
    // ShadowRoot hasn't attached yet, or we're outside one — render
    // nothing so emotion doesn't fall back to `document.head`.
    return null;
  }
  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
