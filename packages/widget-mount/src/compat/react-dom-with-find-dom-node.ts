/**
 * Build-time re-export shim for react-dom, adding the `findDOMNode` React 19
 * dropped. The rule in `packages/widgets/src/kit/webpack-compat.ts` (applied
 * by `applyWidgetCompat` from `next.config.ts`) aliases `react-dom` to this
 * file **only inside react-select@2**, so react-select's static `import { findDOMNode } from
 * 'react-dom'` resolves at build time instead of emitting a "not exported"
 * warning. Everything else keeps the real react-dom.
 *
 * `export *` forwards react-dom's real named exports (createPortal, …) — the
 * same function instances, so portals still attach to the same React tree —
 * and the explicit `findDOMNode` export takes precedence (React 19's react-dom
 * has none). The runtime patch in `./find-dom-node` still stands for widgets
 * that read `ReactDOM.findDOMNode` off the namespace at runtime.
 */
export * from 'react-dom';
export { findDOMNode } from './find-dom-node-impl';
