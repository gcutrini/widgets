import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { liveEventSheets, liveEventStyles } from './vendor-styles';

export const liveEventManifest: WidgetManifest = {
  name: 'live-event',
  load: () => import('live-event-widget/dist/index.js'),
  vendorSheets: liveEventSheets,
  inlineStyles: liveEventStyles,
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Live now' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (packages/web-components/scripts/build.mjs) regardless of widget.
export { liveEventManifest as manifest };
