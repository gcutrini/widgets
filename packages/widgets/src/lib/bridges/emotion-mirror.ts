/**
 * Shadow-aware bridge for emotion styles injected into `document.head`.
 *
 * uicore's form controls use `react-select@2.4.4`, which styles itself
 * with `emotion@9` — a global singleton that appends `<style
 * data-emotion>` tags to `document.head` as elements render. emotion 9
 * predates the `CacheProvider` / `container` API (emotion 10+), so the
 * widgets package's `EmotionShadowProvider` (emotion 11) can't redirect it into
 * shadow scope. The result: react-select dropdowns (the schedule
 * day-picker, registration's company field, extra-questions inputs)
 * render unstyled inside a shadow root because their `css-*` rules live
 * in `document.head`, which the shadow tree can't see.
 *
 * This bridge mirrors every `[data-emotion]` style tag from
 * `document.head` into a single `<style>` at the top of the shadow root,
 * and keeps it synced as more styled elements render. Two sources feed
 * the mirror, together covering every way a rule appears:
 *   - a MutationObserver on `document.head` catches new `<style>` tags and
 *     dev-mode text writes (childList / characterData); and
 *   - in production emotion runs in "speedy" mode, injecting each rule
 *     with `sheet.insertRule()` — a pure CSSOM write that fires NO
 *     mutation. So this bridge wraps `insertRule` on every emotion head
 *     sheet, and each insert notifies the mirror directly. react-select
 *     inserts its menu styles inside the same click handler that opens the
 *     dropdown, so the mirror re-syncs in the following microtask — before
 *     the browser paints — with no polling gap.
 *
 * emotion class names are content-hashed and globally unique
 * (`css-dvua67-singleValue`), so copying them into shadow scope can't
 * collide with anything — the copy simply makes those selectors resolve
 * for the shadow-scoped markup that already carries the class names.
 *
 * Same bridge shape as `bridges/tooltip.ts`: `(root) => cleanup`.
 */

const MIRROR_ATTR = 'data-emotion-mirror';

// Each emotion head sheet is wrapped once, process-wide, and notifies every
// active mirror. A WeakSet keeps a sheet from being wrapped twice (several
// widget shadows run this bridge at once), and the notifier set lets one
// wrapped `insertRule` reach all of them.
const patchedSheets = new WeakSet<CSSStyleSheet>();
const mirrorNotifiers = new Set<() => void>();

function notifyAllMirrors(): void {
  for (const notify of mirrorNotifiers) notify();
}

/**
 * Wrap `insertRule` on every emotion `<style>` sheet in the head that isn't
 * wrapped yet, so speedy-mode inserts (which fire no mutation) notify the
 * mirrors. emotion re-reads `tag.sheet.insertRule` on each insert, so an
 * own-property override on the sheet runs for every rule.
 */
function patchHeadEmotionSheets(): void {
  const tags = document.head.querySelectorAll<HTMLStyleElement>('style[data-emotion]');
  for (const tag of Array.from(tags)) {
    const sheet = tag.sheet;
    if (!sheet || patchedSheets.has(sheet)) continue;
    patchedSheets.add(sheet);
    const insertRule = sheet.insertRule.bind(sheet);
    sheet.insertRule = (rule: string, index?: number): number => {
      const result = insertRule(rule, index);
      notifyAllMirrors();
      return result;
    };
  }
}

/** Read a style tag's CSS — from the CSSOM in emotion's speedy (prod) mode where textContent is empty, else from textContent (dev). */
function readStyleCss(tag: HTMLStyleElement): string {
  const sheet = tag.sheet;
  if (sheet && sheet.cssRules.length > 0) {
    try {
      let out = '';
      for (const rule of Array.from(sheet.cssRules)) out += rule.cssText + '\n';
      return out;
    } catch {
      // Cross-origin/detached sheets throw on cssRules — fall through.
    }
  }
  return tag.textContent ?? '';
}

export function emotionMirrorBridge(root: ShadowRoot): () => void {
  function sync(): void {
    const tags = Array.from(
      document.head.querySelectorAll<HTMLStyleElement>('style[data-emotion]'),
    );
    const css = tags.map(readStyleCss).join('\n');

    let mirror = root.querySelector<HTMLStyleElement>(`style[${MIRROR_ATTR}]`);
    if (!mirror) {
      mirror = document.createElement('style');
      mirror.setAttribute(MIRROR_ATTR, '');
      // Prepend so the widget's own linked/adopted CSS still wins ties.
      root.insertBefore(mirror, root.firstChild);
    }
    if (mirror.textContent !== css) mirror.textContent = css;
  }

  // Coalesce bursts (react-select inserts many rules at once) into one sync
  // per microtask — still ahead of the next paint.
  let scheduled = false;
  function scheduleSync(): void {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      sync();
    });
  }

  mirrorNotifiers.add(scheduleSync);
  patchHeadEmotionSheets();
  sync();

  const observer = new MutationObserver(() => {
    // A new emotion <style> tag may have appeared — wrap its sheet too.
    patchHeadEmotionSheets();
    scheduleSync();
  });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });

  return () => {
    observer.disconnect();
    mirrorNotifiers.delete(scheduleSync);
  };
}
