/**
 * Event contract between the widget lane's sweetalert2 containment and the
 * host's notification UX.
 *
 * The widget dists (and uicore) call `Swal.fire(...)` for error/warning/success
 * popups — a ~78 KB library that also can't render usefully from an isolated
 * shadow-mounted bundle. The web-component build aliases `sweetalert2` to a tiny
 * shim (@openeventkit/widgets' src/kit/compat/uicore-swal.ts) that raises this window
 * event instead; the host's <WidgetNotifyDialog>, mounted with its providers, listens
 * and owns the user-facing treatment. Same producer-outside-React pattern as
 * widget-auth-error (401/403 keep going through that port; everything else —
 * generic errors, validation, success — comes here).
 */

export const WIDGET_NOTIFY_EVENT = 'openeventkit:widget-notify';

export type WidgetNotifyIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

export interface WidgetNotifyDetail {
  title?: string;
  text?: string;
  icon?: WidgetNotifyIcon;
}

export function emitWidgetNotify(detail: WidgetNotifyDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WidgetNotifyDetail>(WIDGET_NOTIFY_EVENT, { detail }));
}

/** Subscribe to widget notifications; returns the unsubscribe function. */
export function onWidgetNotify(handler: (detail: WidgetNotifyDetail) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<WidgetNotifyDetail>).detail ?? {});
  window.addEventListener(WIDGET_NOTIFY_EVENT, listener);
  return () => window.removeEventListener(WIDGET_NOTIFY_EVENT, listener);
}
