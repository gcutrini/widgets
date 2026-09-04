import { css as widgetButtonsCss } from '../../lib/styles/widget-buttons';
import { css as suppressAjaxLoaderCss } from '../../lib/styles/suppress-ajax-loader';
import { css as hideWidgetToolbarCss } from './hide-widget-toolbar';
import { sheet as bootstrap } from '../../lib/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../../lib/vendor-css/font-awesome.min';
import { sheet as reactToastify } from '../../lib/vendor-css/react-toastify';
import { sheet as fullSchedule } from '../../lib/vendor-css/full-schedule-widget';
import { sheet as circleButton } from '../../lib/vendor-css/uicore-circle-button';
import { sheet as buttonCursorSheet } from '../../lib/styles/button-cursor';

/**
 * Style dependencies for the Full Schedule widget.
 *
 * `sheets` — generated vendor-css modules adopted into the shadow root.
 * Order matters: the widget's own CSS comes before circle-button (both
 * hashed, no overlap) and after the vendor supporting styles.
 *
 *   react-toastify — the widget's dist requires this CSS as a side
 *     effect (sync/share toasts); Next hoists that into document.head
 *     where the shadow root can't see it
 *   uicore circle-button — the event cards' add/added/enter toggle;
 *     uicore imports its CSS via JS, same head-hoist problem
 *
 * `styles` — only the `.button` shim: full-schedule uses react-bootstrap
 * `.btn` (styled by Bootstrap 3) AND a plain `.button` class in a few
 * places that has no widget-owned styling.
 *
 * `scheduleFullPortalSheets` — mirrored to document.head by the manifest's
 * scopedPortalCssBridge for the body-portaled event popovers
 * (#popovers-container).
 */

export const scheduleFullSheets = [
  bootstrap,
  fontAwesome,
  reactToastify,
  fullSchedule,
  circleButton,
] as const;

export const scheduleFullStyles = [
  widgetButtonsCss,
  suppressAjaxLoaderCss,
  hideWidgetToolbarCss,
] as const;

export const scheduleFullPortalSheets = [
  fontAwesome,
  fullSchedule,
  circleButton,
  buttonCursorSheet,
] as const;
