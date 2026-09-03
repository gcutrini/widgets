/**
 * Shadow-aware bridge for widgets that close popovers/menus with a
 * document-level "click-outside" listener — the classic
 * `document.addEventListener('click', e => !ref.current.contains(e.target) && close())`.
 *
 * Inside a shadow root this silently breaks. When a click originates in the
 * shadow tree and bubbles out to `document`, the browser **retargets**
 * `event.target` to the shadow HOST (it hides the in-shadow element from
 * listeners outside the tree). So at `document`, `event.target` is the host —
 * an *ancestor* of the popover ref, never a descendant — and
 * `ref.current.contains(event.target)` is always `false`. The handler decides
 * every click is "outside" and closes the popover the instant the toggle opens
 * it. Net effect: the button appears dead (it opens and immediately closes in
 * one click). The my-orders Filter/Sort dropdowns are the current case; any
 * widget with the same pattern hits it.
 *
 * We can't touch the widget's listener, so we fix the event it reads: a
 * **capture-phase** document listener (runs before the widget's bubble-phase
 * one) rewrites `event.target` to the real in-shadow element from
 * `composedPath()[0]` for clicks that started in THIS root. The widget's
 * `contains(event.target)` then sees the true element and its unchanged
 * click-outside logic works. Scoped per-root and only for events retargeted to
 * our own host, so it never touches events from elsewhere on the page.
 */

type Cleanup = () => void;

// The events widgets use to detect an outside click/tap. Capture-phase on
// document, so the rewrite is in place before any bubble-phase listener reads
// `event.target`.
const RETARGET_EVENTS = ['pointerdown', 'mousedown', 'click'] as const;

export function clickOutsideRetargetBridge(root: ShadowRoot): Cleanup {
  const host = root.host;

  const onEvent = (event: Event): void => {
    // At document level a click from inside our shadow tree shows up with
    // `target === host`; `composedPath()[0]` is the real (un-retargeted)
    // element. Only rewrite when the event genuinely crossed OUR boundary.
    if (event.target !== host) return;
    const path = event.composedPath();
    const real = path[0];
    if (!(real instanceof Node) || real === host || !path.includes(root)) return;
    try {
      Object.defineProperty(event, 'target', { configurable: true, get: () => real });
    } catch {
      // target already rewritten or non-configurable — leave it as-is.
    }
  };

  RETARGET_EVENTS.forEach((type) => document.addEventListener(type, onEvent, true));
  return () =>
    RETARGET_EVENTS.forEach((type) => document.removeEventListener(type, onEvent, true));
}
