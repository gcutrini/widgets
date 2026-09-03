import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { upcomingEventsSheets, upcomingEventsStyles } from './vendor-styles';

export const upcomingEventsManifest: WidgetManifest = {
  name: 'upcoming-events',
  load: () => import('upcoming-events-widget/dist'),
  vendorSheets: upcomingEventsSheets,
  inlineStyles: upcomingEventsStyles,
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Upcoming events' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (packages/web-components/scripts/build.mjs) regardless of widget.
export { upcomingEventsManifest as manifest };
