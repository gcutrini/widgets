/// <reference path="../../lib/widget-modules.d.ts" />
import type { WidgetManifest } from '../../core/manifest';
import { emotionMirrorBridge } from '../../lib/bridges/emotion-mirror';
import { scheduleFiltersSheets } from './vendor-styles';

export const scheduleFiltersManifest: WidgetManifest = {
  name: 'schedule-filters',
  load: () => import('schedule-filter-widget/dist'),
  vendorSheets: scheduleFiltersSheets,
  // The filter dropdowns are uicore react-selects styled by emotion@9 into
  // document.head; mirror those rules into the shadow.
  bridges: [emotionMirrorBridge],
  elementTag: 'aside',
  elementAttrs: { 'aria-label': 'Schedule filters' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (@openeventkit/web-components' scripts/build.mjs) regardless of widget.
export { scheduleFiltersManifest as manifest };
