/**
 * Shallow-isolates a widget's props so legacy widgets can mutate what they're
 * handed without corrupting host state.
 *
 * Legacy widgets (React-16 / Redux era) treat props as owned, mutable state.
 * `lite-schedule-widget`, for example, runs `summit.dates = getSummitDates(summit)`
 * on the summit object it receives during render. Because that object is a
 * slice of our real-time store (the store returns state by reference — the
 * required `useSyncExternalStore` contract), the mutation lands on the store;
 * the moment objects it writes then break the sync worker's structured clone
 * (see #155 / `RealTimeProvider.processUpdates`).
 *
 * We can't change the store (returning copies would break `useSyncExternalStore`)
 * and we can't stop the widget mutating (it reads its own writes back). So the
 * widget frame is the boundary: every widget gets its own top-level containers.
 *
 * Each array and plain-object prop is shallow-copied. Functions (callbacks),
 * primitives, and NON-plain objects (Date, Map, moment, other class instances)
 * pass through unchanged, so we never strip a prototype or a bound method.
 *
 * SHALLOW ON PURPOSE — this protects the observed mutation shape (top-level
 * reassignment: `summit.dates = …`). It does NOT protect against a widget
 * mutating a *nested* value it was given (e.g. `events[0].foo = …` or
 * `summit.tracks[0].bar = …`), because the copied array/object still holds the
 * original nested references.
 *
 * If a widget is ever found to mutate nested data, escalate to a deep copy for
 * that case. To do so: add an opt-in to the widget's `WidgetManifest` (e.g.
 * `deepIsolate: true` or a per-prop list) and, for those props, clone deeply while preserving
 * functions — a structured clone works but throws on functions and on values a
 * *previous* render already dirtied, so a bespoke recursive clone that skips
 * functions/non-plain objects is safer. Keep it opt-in: deep-copying every
 * prop each render (e.g. the ~40-event array) is a real per-render cost we
 * don't want to pay for the common case.
 */

'use client';

import { useRef } from 'react';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function mutationSafeProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (Array.isArray(value)) out[key] = [...value];
    else if (isPlainObject(value)) out[key] = { ...value };
    else out[key] = value;
  }
  return out;
}

function shallowEqualProps(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  for (const k of ak) {
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

/**
 * `mutationSafeProps`, but only re-clones when a source prop reference actually
 * changed. Returns a referentially STABLE object across renders whose source
 * props are shallow-equal — the whole point: the widget host can then memoize
 * the widget element on this result, so an unrelated host re-render (same
 * data) yields the same element and React skips re-rendering the legacy
 * bundle, which would otherwise re-init from "new" props.
 *
 * When the source is unchanged we return the SAME clone as last render, which
 * also preserves any top-level mutation the legacy widget made to it (the
 * widget reads its own writes back — see mutationSafeProps above). A real data
 * change re-clones fresh and the widget re-derives.
 */
export function useMutationSafeProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const prev = useRef<{
    src: Record<string, unknown>;
    out: Record<string, unknown>;
  } | null>(null);

  if (prev.current && shallowEqualProps(prev.current.src, props)) {
    return prev.current.out;
  }
  const out = mutationSafeProps(props);
  prev.current = { src: props, out };
  return out;
}
