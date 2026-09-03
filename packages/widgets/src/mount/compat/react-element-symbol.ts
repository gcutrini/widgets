/**
 * React 19 renamed the element `$$typeof` marker from
 * `Symbol.for('react.element')` to `Symbol.for('react.transitional.element')`.
 * Legacy widget dependencies detect React elements with the old symbol —
 * e.g. the deepmerge bundled inside pure-react-carousel skips anything whose
 * `$$typeof` is the old symbol, and deep-clones everything else. Under
 * React 19 that check never matches, so it recurses into elements' cyclic
 * internals and overflows the call stack on mount.
 *
 * Those bundles resolve the symbol once, at module-evaluation time. This
 * shim wraps the global `Symbol.for` so a lookup of `'react.element'`
 * returns the transitional symbol instead. Scope of effect: only modules
 * evaluated AFTER this shim that ask for exactly `'react.element'` — in a
 * React 19 app any such caller is performing the outdated element check
 * this redirects. React itself (vendored by Next) evaluates long before
 * widget bundles and caches its own constants, so it is unaffected.
 *
 * Must be imported before any widget bundle evaluates. The host's
 * reactComponent renderer imports it alongside the other compat shims,
 * ahead of every next/dynamic widget load.
 */

const originalSymbolFor = Symbol.for.bind(Symbol);
const TRANSITIONAL_ELEMENT = originalSymbolFor('react.transitional.element');

Symbol.for = ((key: string) =>
  key === 'react.element'
    ? TRANSITIONAL_ELEMENT
    : originalSymbolFor(key)) as typeof Symbol.for;

export {};
