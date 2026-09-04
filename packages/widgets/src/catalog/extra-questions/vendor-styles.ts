import { sheet as bootstrap } from '../../lib/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../../lib/vendor-css/font-awesome.min';
import { sheet as abcCheckbox } from '../../lib/vendor-css/awesome-bootstrap-checkbox';
import { sheet as uicoreExtraQuestions } from '../../lib/vendor-css/uicore-extra-questions';

/**
 * Style dependencies for the Extra Questions form (uicore
 * `ExtraQuestionsForm` mounted in a shadow root).
 *
 * Rationale for each sheet:
 *   Bootstrap 3 — the form renders `.form-control` text inputs and
 *     `.form-check` structures that assume bootstrap's form styling
 *   Font Awesome 4 — `.extra-question-error:before` renders the warning
 *     glyph via `font-family: FontAwesome`
 *   awesome-bootstrap-checkbox — styles the `.abc-checkbox` / `.abc-radio`
 *     structure (hides the native control, draws a custom one); uicore
 *     imports it as a JS side effect, which lands in `document.head`
 *     where shadow scope can't see it
 *   uicore-extra-questions — uicore's own `.questions-form` layout /
 *     error-label CSS, likewise only importable as a JS side effect
 */

export const extraQuestionsSheets = [
  bootstrap,
  fontAwesome,
  abcCheckbox,
  uicoreExtraQuestions,
] as const;
