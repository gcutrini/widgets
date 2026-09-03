import { sheet as bootstrap } from '../kit/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../kit/vendor-css/font-awesome.min';
import { sheet as freeTextSearch } from '../kit/vendor-css/uicore-free-text-search';
import { sheet as liteSchedule } from '../kit/vendor-css/lite-schedule-widget';
import { sheet as circleButton } from '../kit/vendor-css/uicore-circle-button';
import { transitionGroupFadeFix } from './transition-group';
import { css as suppressAjaxLoaderCss } from '../kit/styles/suppress-ajax-loader';

/**
 * Style dependencies for the Lite Schedule widget.
 *
 * The widget uses react-bootstrap components (Bootstrap 3 classes) and
 * `fa fa-*` icons; uicore's free-text-search box (the showSearch input)
 * and CircleButton (event card add/added/enter toggle) ship their CSS as
 * JS side-effect imports that Next hoists to document.head — invisible
 * to the shadow root, so their generated modules are adopted here.
 * sweetalert2 popups portal to `document.body` (their CSS self-injects
 * at head level) — nothing to bridge.
 */

export const scheduleLiteSheets = [
  bootstrap,
  fontAwesome,
  freeTextSearch,
  liteSchedule,
  circleButton,
] as const;

/**
 * Hand-authored CSS adopted into the shadow root (not generated vendor
 * sheets): the react-transition-group fade fix, and suppression of uicore's
 * stray AjaxLoader overlay.
 */
export const scheduleLiteStyles = [
  transitionGroupFadeFix,
  suppressAjaxLoaderCss,
] as const;
