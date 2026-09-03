import { sheet as bootstrap } from '../kit/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../kit/vendor-css/font-awesome.min';
import { sheet as eventFeedback } from '../kit/vendor-css/event-feedback-widget';

/**
 * Style dependencies for the Event Feedback widget — Bootstrap for its
 * layout classes, Font Awesome for the `fa fa-trash` delete glyph, then
 * the widget's own hashed CSS.
 */

export const eventFeedbackSheets = [bootstrap, fontAwesome, eventFeedback] as const;
