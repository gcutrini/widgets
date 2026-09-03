/// <reference path="../kit/widget-modules.d.ts" />
import type { ComponentType } from 'react';
import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { emotionMirrorBridge } from '../kit/bridges/emotion-mirror';
import { extraQuestionsSheets } from './vendor-styles';

export const extraQuestionsManifest: WidgetManifest = {
  name: 'extra-questions',
  load: () =>
    import('openstack-uicore-foundation/lib/components/extra-questions').then((m) => ({
      // The ambient decl types the form's own props; the manifest's load
      // contract is the widest widget shape.
      default: m.default as unknown as ComponentType<Record<string, unknown>>,
    })),
  vendorSheets: extraQuestionsSheets,
  // Dropdown questions render via react-select@2 (emotion@9 → document.head);
  // mirror those rules into the shadow.
  bridges: [emotionMirrorBridge],
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Additional registration questions' },
};
