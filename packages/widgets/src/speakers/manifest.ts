import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { speakersSheets } from './vendor-styles';

export const speakersManifest: WidgetManifest = {
  name: 'speakers',
  load: () => import('speakers-widget/dist'),
  vendorSheets: speakersSheets,
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Speakers' },
};

// Uniform alias so the web-component entry codegen can import `{ manifest }`
// (packages/web-components/scripts/build.mjs) regardless of widget.
export { speakersManifest as manifest };
