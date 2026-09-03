import { sheet as bootstrap } from '../lib/vendor-css/bootstrap.min';
import { sheet as fontAwesome } from '../lib/vendor-css/font-awesome.min';
import { sheet as filterWidget } from '../lib/vendor-css/schedule-filter-widget';

/**
 * Style dependencies for the Schedule Filters widget — Bootstrap for
 * layout classes, Font Awesome for the filter/search glyphs, then the
 * widget's own (mostly hashed) CSS.
 */

export const scheduleFiltersSheets = [bootstrap, fontAwesome, filterWidget] as const;
