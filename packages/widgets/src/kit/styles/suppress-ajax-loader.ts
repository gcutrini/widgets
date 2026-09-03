/**
 * Hide the widget's busy loader for widgets that opt out.
 *
 * Every widget's `<AjaxLoader show/>` renders the host-styled `.wc-ajax-loader`
 * backdrop (kit/compat/uicore-ajaxloader). The schedule widgets show it while
 * an RSVP (add/remove-to-schedule) request is in flight, but there the button's
 * own add → ✓ state is the feedback, so a full backdrop over the whole schedule
 * is unwanted. A widget includes this in its vendor-styles to suppress the
 * backdrop; a widget that wants it (e.g. reg-lite) simply omits it.
 */

export const css: string = `
.wc-ajax-loader {
  display: none !important;
}
`;
