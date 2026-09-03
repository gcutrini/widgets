/**
 * Event contract for render errors escaping a web-component island. The
 * island's React-17 boundary catches the error and dispatches this event on
 * the custom element; the host-side renderer listens and rethrows into the
 * host's boundary. Element-scoped (not window): the error belongs to one
 * widget instance.
 */

export const WIDGET_ERROR_EVENT = 'widget-error';

export interface WidgetErrorDetail {
  error: unknown;
}
