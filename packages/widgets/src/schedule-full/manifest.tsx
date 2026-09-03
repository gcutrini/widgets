/// <reference path="../kit/widget-modules.d.ts" />
import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { tooltipBridge } from '../kit/bridges/tooltip';
import { scopedPortalCssBridge } from '../kit/bridges/scoped-portal-css';
import { EmotionShadowProvider } from '../kit/context/EmotionShadowProvider';
import { deepLinkBridge } from './deep-link';
import {
  scheduleFullSheets,
  scheduleFullStyles,
  scheduleFullPortalSheets,
} from './vendor-styles';

export const scheduleFullManifest: WidgetManifest = {
  name: 'schedule-full',
  load: () => import('full-schedule-widget/dist'),
  vendorSheets: scheduleFullSheets,
  inlineStyles: scheduleFullStyles,
  bridges: [
    tooltipBridge,
    deepLinkBridge,
    // Event popovers portal to #popovers-container (light DOM); mirror their CSS
    // to document.head — including circle-button (the add-to-schedule toggle) and
    // button-cursor (the toggle is a native <button>, which has no pointer here
    // since bootstrap's reset lives inside the shadow, not this container).
    scopedPortalCssBridge('#popovers-container', [...scheduleFullPortalSheets]),
  ],
  // The widget's MUI subtree styles via emotion@11 — point its cache at the shadow.
  wrapTree: (children) => (
    <EmotionShadowProvider cacheKey="w-schedule-full">{children}</EmotionShadowProvider>
  ),
  // v5-era MUI (via the emotion wrapTree); dist pulls PDF export (Node built-ins).
  runtimeNeeds: ['pin:mui5-react17', 'stub:node'],
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Event schedule' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (packages/web-components/scripts/build.mjs) regardless of widget.
export { scheduleFullManifest as manifest };
