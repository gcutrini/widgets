/// <reference path="../kit/widget-modules.d.ts" />
import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { emotionMirrorBridge } from '../kit/bridges/emotion-mirror';
import { clickOutsideRetargetBridge } from '../kit/bridges/click-outside-retarget';
import { myTicketsSheets, myTicketsStyles } from './vendor-styles';
// Side-effect: seed the widget's i18n dictionary before it mounts.
import 'my-orders-tickets-widget/dist/i18n';

export const myTicketsManifest: WidgetManifest = {
  name: 'my-tickets',
  load: () => import('my-orders-tickets-widget/dist/index'),
  vendorSheets: myTicketsSheets,
  inlineStyles: myTicketsStyles,
  // The widget portals its filter/sort dropdowns into document.body — inject
  // its (hashed) CSS to the head so that markup is styled too.
  portalSheets: myTicketsSheets,
  // emotion-mirror: the widget's MUI runs on its own split emotion-11 instance
  // that injects into document.head; click-outside-retarget: its Filter/Sort
  // dropdowns read a retargeted event.target inside shadow.
  bridges: [emotionMirrorBridge, clickOutsideRetargetBridge],
  // v5-era MUI; dist pulls @react-pdf/renderer (Node built-ins); ships its own
  // MUI theme (CustomTheme) with no fontFamily.
  runtimeNeeds: ['pin:mui5-react17', 'stub:node', 'quirk:myTicketsFont'],
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'My orders and tickets' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (@openeventkit/web-components' scripts/build.mjs) regardless of widget.
export { myTicketsManifest as manifest };
