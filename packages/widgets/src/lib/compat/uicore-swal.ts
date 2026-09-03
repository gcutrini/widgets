/**
 * Shim for `sweetalert2` in the web-component build.
 *
 * uicore and several widget dists call `Swal.fire(...)` for error/warning/success
 * popups — a ~78 KB library that also can't render usefully from a shadow-mounted
 * isolated bundle. The build aliases `sweetalert2` to this module so the real
 * library is never bundled: fire-and-forget dialogs are forwarded to the host via
 * the widget-notify port (<WidgetNotifyDialog> renders them), and the interactive
 * form resolves as dismissed/not-confirmed so no destructive branch runs.
 *
 * 401/403 auth errors do NOT reach here — uicore hands those to the handler
 * uicore-host registers, which routes them through the widget-auth-error port
 * before Swal would be called.
 *
 * Deleted when uicore drops its sweetalert2 dependency upstream (see UPSTREAM.md).
 */
import { emitWidgetNotify, type WidgetNotifyIcon } from '../../core/widget-notify';

// sweetalert2's SweetAlertResult; uicore checks `result.value`, newer code
// `result.isConfirmed`. We always resolve "dismissed" so confirmations no-op.
interface SwalResult {
  isConfirmed: boolean;
  isDenied: boolean;
  isDismissed: boolean;
  value: undefined;
}

const dismissed = (): Promise<SwalResult> =>
  Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true, value: undefined });

const asIcon = (v: unknown): WidgetNotifyIcon | undefined =>
  v === 'success' || v === 'error' || v === 'warning' || v === 'info' || v === 'question' ? v : undefined;

// Swal.fire(title, text, icon) OR Swal.fire({ title, text, html, icon|type, ... }).
function fire(...args: unknown[]): Promise<SwalResult> {
  let detail;
  if (args.length && typeof args[0] === 'object' && args[0] !== null) {
    const s = args[0] as Record<string, unknown>;
    detail = { title: s.title as string, text: (s.text ?? s.html) as string, icon: asIcon(s.icon ?? s.type) };
  } else {
    const [title, text, icon] = args as [string?, string?, string?];
    detail = { title, text, icon: asIcon(icon) };
  }
  emitWidgetNotify(detail);
  return dismissed();
}

// Minimal surface uicore/widgets touch; anything else no-ops safely.
const Swal = { fire, close: () => {}, mixin: () => Swal, isVisible: () => false };
export default Swal;
