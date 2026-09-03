/**
 * @openeventkit/widgets — the uicore isolation layer for legacy widget
 * packages.
 *
 * Each widget exposes its manifest via its own subpath
 * (`@openeventkit/widgets/schedule-full/manifest`, …) — see package.json
 * `exports`. This barrel carries only the small client-safe shared surface.
 */

export { ClockProvider, useClockSelector } from './kit/ClockProvider';

// This barrel is imported from client code and its import graph gets
// pulled into every page that touches it. Exports below must stay
// small + client-safe. Modules that would drag heavy transitive graphs
// (uicore inputs → react-select) or `server-only` code are consumed via
// their own subpath — see package.json `exports`.
