import type { WidgetManifest } from '@openeventkit/widget-core/manifest';
import { tooltipBridge } from '../kit/bridges/tooltip';
import { emotionMirrorBridge } from '../kit/bridges/emotion-mirror';
import { EmotionShadowProvider } from '../kit/context/EmotionShadowProvider';
import { MuiThemeBridge } from '../kit/context/MuiThemeBridge';
import { registrationSheets, registrationStyles } from './vendor-styles';

export const registrationManifest: WidgetManifest = {
  name: 'registration',
  load: () => import('summit-registration-lite/dist/components/registration-form'),
  vendorSheets: registrationSheets,
  inlineStyles: registrationStyles,
  // tooltip: react-tooltip@3 scans document for [data-tip] and misses shadow;
  // emotion-mirror: the widget's MUI runs on a split emotion-11 instance that
  // injects into document.head (react-select company field, etc.).
  bridges: [tooltipBridge, emotionMirrorBridge],
  // The widget's MUI subtree styles via emotion@11 — point its cache at the shadow
  // (EmotionShadowProvider) and give it the event font (MuiThemeBridge, inside so
  // the emotion cache sits above MUI).
  wrapTree: (children) => (
    <EmotionShadowProvider cacheKey="w-registration">
      <MuiThemeBridge>{children}</MuiThemeBridge>
    </EmotionShadowProvider>
  ),
  // v5-era MUI (dist + the MuiThemeBridge/emotion wrapTree).
  runtimeNeeds: ['pin:mui5-react17'],
  elementTag: 'section',
  elementAttrs: { 'aria-label': 'Registration form' },
};

export { registrationManifest as manifest };
