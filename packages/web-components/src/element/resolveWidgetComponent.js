/**
 * resolveWidgetComponent — the widget dists are webpack UMD bundles (__esModule)
 * whose component sits at different interop depths once re-bundled by esbuild.
 * Pick the first candidate that is actually a component (function).
 *
 * NOTE: this heuristic only exists because we wrap the widget from OUTSIDE its
 * repo. When a widget repo owns its own web-component entry it imports its
 * component directly and this goes away.
 *
 * @param {any} ns  the `import * as ns from 'the-widget/dist'` namespace
 */
export function resolveWidgetComponent(ns) {
  const candidates = [
    ns && ns.default,
    ns && ns.default && ns.default.default,
    ns,
    ns && typeof ns === 'object'
      ? Object.values(ns).find((v) => typeof v === 'function')
      : undefined,
  ];
  for (const c of candidates) if (typeof c === 'function') return c;
  return ns && ns.default;
}
