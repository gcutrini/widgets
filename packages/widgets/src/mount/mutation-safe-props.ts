/**
 * Shallow-isolates a widget's props so legacy widgets can mutate what they're
 * handed without corrupting host state.
 *
 * Legacy widgets (React-16 / Redux era) treat props as owned, mutable state
 * and reassign top-level fields on the objects they receive during render
 * (e.g. `summit.dates = …`). Handed a live store slice — stores return state
 * by reference, the required `useSyncExternalStore` contract — that write
 * lands on host state. The store can't return copies and the widget can't
 * stop mutating (it reads its own writes back), so the renderer is the
 * boundary: every widget gets its own top-level containers. Full story:
 * CONSTRAINTS.md RC-W.
 *
 * Each array and plain-object prop is shallow-copied. Functions (callbacks),
 * primitives, and NON-plain objects (Date, Map, moment, other class instances)
 * pass through unchanged, so we never strip a prototype or a bound method.
 *
 * SHALLOW ON PURPOSE — this protects top-level reassignment, not a widget
 * mutating a *nested* value it was given (`events[0].foo = …`). If that ever
 * surfaces, escalate that widget to a deep copy via a `WidgetManifest` opt-in,
 * cloning with a bespoke recursive copy that preserves functions (a structured
 * clone throws on them). Keep it opt-in — deep-copying every prop each render
 * is a real cost. Escalation notes: CONSTRAINTS.md RC-W.
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
 * props are shallow-equal — the whole point: the renderer memoizes its widget
 * tree (or skips `setProps`) on this result, so an unrelated host re-render
 * (same data) yields the same element and the legacy bundle is not
 * re-rendered — it would otherwise re-init from "new" props.
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
