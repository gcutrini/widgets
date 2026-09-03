/**
 * Event contract between the widget lane's auth-error containment and
 * the host's auth UX.
 *
 * The auth-error handler the widgets package hands uicore (uicore-host)
 * receives every 401/403 from every widget dist, but it is a plain function
 * with no access to React context — it cannot open the login modal or a
 * dialog itself. It raises this window event instead; <WidgetAuthErrorDialog>,
 * mounted with the app providers, listens and owns the entire user-facing
 * treatment. Same producer-outside-React pattern as the widget needsLogin
 * bridge.
 */

export const WIDGET_AUTH_ERROR_EVENT = 'openeventkit:widget-auth-error';

export type WidgetAuthErrorStatus = 401 | 403;

export interface WidgetAuthErrorDetail {
  status: WidgetAuthErrorStatus;
}

export function emitWidgetAuthError(detail: WidgetAuthErrorDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<WidgetAuthErrorDetail>(WIDGET_AUTH_ERROR_EVENT, { detail }),
  );
}

/** Subscribe to widget auth errors; returns the unsubscribe function. */
export function onWidgetAuthError(
  handler: (detail: WidgetAuthErrorDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<WidgetAuthErrorDetail>).detail;
    if (detail?.status === 401 || detail?.status === 403) handler(detail);
  };
  window.addEventListener(WIDGET_AUTH_ERROR_EVENT, listener);
  return () => window.removeEventListener(WIDGET_AUTH_ERROR_EVENT, listener);
}
