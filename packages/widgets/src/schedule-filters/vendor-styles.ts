import { sheet as bootstrap } from '../kit/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../kit/vendor-css/font-awesome.min';
import { sheet as filterWidget } from '../kit/vendor-css/schedule-filter-widget';

/**
 * Style dependencies for the Schedule Filters widget — Bootstrap for
 * layout classes, Font Awesome for the filter/search glyphs, then the
 * widget's own (mostly hashed) CSS.
 */

export const scheduleFiltersSheets = [bootstrap, fontAwesome, filterWidget] as const;
