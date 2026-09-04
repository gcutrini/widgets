/// <reference path="../../lib/widget-modules.d.ts" />
import type { WidgetManifest } from '../../core/manifest';
import { emotionMirrorBridge } from '../../lib/bridges/emotion-mirror';
import { scheduleLiteSheets, scheduleLiteStyles } from './vendor-styles';

export const scheduleLiteManifest: WidgetManifest = {
  name: 'schedule-lite',
  load: () => import('lite-schedule-widget/dist'),
  vendorSheets: scheduleLiteSheets,
  inlineStyles: scheduleLiteStyles,
  // The day-picker is a uicore react-select styled by emotion@9 into
  // document.head; mirror those rules into the shadow so it isn't unstyled.
  bridges: [emotionMirrorBridge],
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Schedule' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (@openeventkit/web-components' scripts/build.mjs) regardless of widget.
export { scheduleLiteManifest as manifest };
