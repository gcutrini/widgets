import { sheet as bootstrap } from '../../lib/vendor-css/bootstrap.min';
import { sheet as slick } from '../../lib/vendor-css/slick';
import { sheet as slickTheme } from '../../lib/vendor-css/slick-theme';
import { sheet as speakers } from '../../lib/vendor-css/speakers-widget';

/**
 * Style dependencies for the Speakers widget.
 *
 *   Bootstrap 3 — the widget renders react-bootstrap grid markup
 *     (row/col classes emitted at runtime, so no literals in the dist)
 *   slick-carousel pair — the dist hard-requires both slick.css and
 *     slick-theme.css (its own CSS only ships .slick-* overrides on top);
 *     slick-theme's font/gif assets live under the package's assets/ dir
 *     (served by the host at assetBaseUrl + /widget-css/) where
 *     its rewritten url()s point
 *   Own CSS last so its .slick-* overrides win cascade ties.
 */

export const speakersSheets = [bootstrap, slick, slickTheme, speakers] as const;
