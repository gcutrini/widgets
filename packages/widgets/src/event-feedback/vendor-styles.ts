import { sheet as bootstrap } from '../lib/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../lib/vendor-css/font-awesome.min';
import { sheet as eventFeedback } from '../lib/vendor-css/event-feedback-widget';

/**
 * Style dependencies for the Event Feedback widget — Bootstrap for its
 * layout classes, Font Awesome for the `fa fa-trash` delete glyph, then
 * the widget's own hashed CSS.
 */

export const eventFeedbackSheets = [bootstrap, fontAwesome, eventFeedback] as const;
