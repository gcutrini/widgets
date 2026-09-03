import { sheet as fontAwesome } from '../kit/vendor-css/font-awesome.min';
import { sheet as circleButton } from '../kit/vendor-css/uicore-circle-button';
import { sheet as liveEvent } from '../kit/vendor-css/live-event-widget';
import { css as buttonCursorCss } from '../kit/styles/button-cursor';

/**
 * Style dependencies for the Live Event widget — Font Awesome for the
 * clock/picture glyphs, uicore circle-button (enter toggle), then the
 * widget's own hashed CSS.
 */

export const liveEventSheets = [fontAwesome, circleButton, liveEvent] as const;

/**
 * Hand-authored CSS adopted into the shadow root: pointer cursor on the
 * uicore CircleButton. live-event doesn't adopt bootstrap (which supplies it
 * for the schedule widgets), so its buttons need this rule.
 */
export const liveEventStyles = [buttonCursorCss] as const;
