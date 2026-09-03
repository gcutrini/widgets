/**
 * Restores `ReactDOM.findDOMNode` for legacy widget bundles.
 *
 * React 19 removed `findDOMNode`. Next.js 16's App Router renders all
 * client components with its own bundled React 19 (`next/dist/compiled/
 * react-dom`) and rewrites every bare `react-dom` import in client code —
 * including inside `node_modules` widget dists — to that copy. So even
 * though this workspace pins `react-dom@18.3.1` (which *does* export
 * `findDOMNode`), the widgets never see it: their `require("react-dom")`
 * resolves to Next's `findDOMNode`-less build. A package-level `react-dom`
 * dependency can't override this — the alias is applied at bundle time.
 *
 * Several legacy widgets call `findDOMNode` unconditionally:
 *   - `lite-schedule-widget` — `CSSTransitionGroupChild` (the animated
 *     `EventList`) calls `findDOMNode(this)` on enter/leave. Without it the
 *     widget throws `findDOMNode is not a function` and the whole schedule
 *     is replaced by the error boundary.
 *   - other `react-transition-group@1`-based widgets share the same code.
 *
 * This module re-attaches a `findDOMNode` implementation onto the react-dom
 * module object the widgets resolve to. Because webpack dedupes `react-dom`
 * to a single module instance across chunks, patching it once (when the
 * reactComponent renderer loads, before any `next/dynamic` widget import resolves) makes
 * it visible to every widget bundle. The patch is a no-op if a real
 * `findDOMNode` is already present, so it stays inert under a react-dom that
 * still ships one.
 *
 * The implementation mirrors what React's own `findDOMNode` did: read the
 * class instance's fiber (`_reactInternals`) and return the first host
 * (DOM) node in its subtree.
 */

import { findDOMNode } from './find-dom-node-impl';

import reactDomModule from 'react-dom';

/**
 * Default import rather than `import * as`: we need the mutable CJS
 * `module.exports` object that widgets' `require("react-dom")` returns —
 * which is what a default import of a CJS module yields under bundler
 * interop — not the sealed ESM namespace (assigning to that throws in
 * strict mode). Bare `require()` is not an option either: in an ESM dist
 * webpack leaves it untranspiled and the browser throws
 * "require is not defined".
 */
const reactDom = reactDomModule as unknown as Record<string, unknown>;

if (typeof reactDom.findDOMNode !== 'function') {
  reactDom.findDOMNode = findDOMNode;
}

export {};
