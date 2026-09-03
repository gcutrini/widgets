/**
 * `#event=<id>` deep link for the full schedule.
 *
 * Share links and outside pages can target a specific event card. The
 * widget renders each card with `id="event-<id>"` INSIDE the shadow root,
 * where `document.getElementById` can't see it — so this runs as a widget
 * bridge (it receives the shadow root at attach time). It waits for the
 * target card to render (the widget mounts client-side after data settles),
 * scrolls it into view, and removes the consumed `event` param from the
 * fragment.
 *
 * Same bridge shape as the `kit/bridges/`: `(root) => cleanup`.
 */

const SCROLL_DELAY_MS = 800;
const WAIT_TIMEOUT_MS = 15_000;

export function deepLinkBridge(root: ShadowRoot): () => void {
  let observer: MutationObserver | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  let giveUpTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    observer?.disconnect();
    observer = null;
    if (scrollTimer) clearTimeout(scrollTimer);
    if (giveUpTimer) clearTimeout(giveUpTimer);
  };

  const match = /(?:^|[#&])event=([^&]+)/.exec(window.location.hash);
  if (!match) return cleanup;
  const eventId = decodeURIComponent(match[1]);

  const consumeParam = () => {
    const remaining = window.location.hash
      .replace(/^#/, '')
      .split('&')
      .filter((pair) => pair !== '' && !pair.startsWith('event='))
      .join('&');
    window.history.replaceState(
      null,
      '',
      window.location.pathname +
        window.location.search +
        (remaining ? `#${remaining}` : ''),
    );
  };

  const tryScroll = (): boolean => {
    const card = root.getElementById(`event-${eventId}`);
    if (!card) return false;
    cleanup();
    scrollTimer = setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      consumeParam();
    }, SCROLL_DELAY_MS);
    return true;
  };

  if (!tryScroll()) {
    observer = new MutationObserver(() => {
      tryScroll();
    });
    observer.observe(root, { childList: true, subtree: true });
    // The event may not exist (unpublished, filtered out on another summit):
    // stop watching eventually rather than observing forever.
    giveUpTimer = setTimeout(cleanup, WAIT_TIMEOUT_MS);
  }

  return cleanup;
}
