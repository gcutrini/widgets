import { sheet as fontAwesome } from '../lib/vendor-css/font-awesome.min';
import { sheet as reactCarousel } from '../lib/vendor-css/react-carousel';
import { sheet as circleButton } from '../lib/vendor-css/uicore-circle-button';
import { sheet as upcomingEvents } from '../lib/vendor-css/upcoming-events-widget';
import { css as buttonCursorCss } from '../lib/styles/button-cursor';
import { css as suppressAjaxLoaderCss } from '../lib/styles/suppress-ajax-loader';

/**
 * Style dependencies for the Upcoming Events widget.
 *
 *   pure-react-carousel — the slide track's layout CSS; the widget's JS
 *     imports it as a side effect that Next hoists to document.head,
 *     invisible to the shadow. Without it slides stack vertically.
 *   uicore circle-button — the event cards' add/added/enter toggle.
 *   Own CSS last — it ships .carousel overrides on top of the vendor CSS.
 */

export const upcomingEventsSheets = [
  fontAwesome,
  reactCarousel,
  circleButton,
  upcomingEvents,
] as const;

/**
 * Hand-authored CSS adopted into the shadow root: suppression of uicore's stray
 * AjaxLoader overlay (the busy spinner shown during add/remove-to-schedule
 * writes), matching the schedule widgets.
 */
export const upcomingEventsStyles = [buttonCursorCss, suppressAjaxLoaderCss] as const;
