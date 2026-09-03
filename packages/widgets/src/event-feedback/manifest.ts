/// <reference path="../kit/widget-modules.d.ts" />
import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { eventFeedbackSheets } from './vendor-styles';

export const eventFeedbackManifest: WidgetManifest = {
  name: 'event-feedback',
  load: () => import('event-feedback-widget/dist'),
  vendorSheets: eventFeedbackSheets,
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Session feedback' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (packages/web-components/scripts/build.mjs) regardless of widget.
export { eventFeedbackManifest as manifest };
