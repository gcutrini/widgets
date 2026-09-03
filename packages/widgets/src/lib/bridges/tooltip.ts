/**
 * Shadow-aware bridge for `react-tooltip@3`, which the widget uses to
 * render tooltips like "Need multiple ticket types?" → "Only one ticket
 * type can be selected per order…".
 *
 * The upstream library attaches its hover handlers by scanning the
 * document for `[data-tip]` elements at init time — but `document.query
 * SelectorAll` doesn't see inside shadow trees, so none of the shadow-
 * scoped triggers get handlers, and the tooltip content just sits there
 * hidden (because our react-tooltip CSS in shadow defaults `.__react_
 * component_tooltip` to `visibility: hidden`).
 *
 * This bridge reimplements the minimum of react-tooltip's runtime that
 * matters for our widgets: scan shadow for `[data-tip][data-for]`
 * triggers, look up the matching tooltip by `#${data-for}`, and toggle
 * the `.show` class + position on hover. Works for `place-{top|bottom|
 * left|right}` — the four react-tooltip@3 placements our widgets use.
 *
 * See `ReactTooltip/react-tooltip#1029` for the upstream shadow-DOM gap.
 */

const GAP_PX = 8;

type Cleanup = () => void;

function detectPlace(tooltip: HTMLElement): 'top' | 'bottom' | 'left' | 'right' {
  const cl = tooltip.classList;
  if (cl.contains('place-top')) return 'top';
  if (cl.contains('place-left')) return 'left';
  if (cl.contains('place-right')) return 'right';
  return 'bottom';
}

function positionTooltip(
  tooltip: HTMLElement,
  rect: DOMRect,
  place: ReturnType<typeof detectPlace>,
): void {
  // Measure while the tooltip is still off-screen — width/height are
  // real even when position is `fixed; left: -999em; top: -999em`.
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;

  let top = 0;
  let left = 0;
  if (place === 'bottom') {
    top = rect.bottom + GAP_PX;
    left = rect.left + rect.width / 2 - w / 2;
  } else if (place === 'top') {
    top = rect.top - h - GAP_PX;
    left = rect.left + rect.width / 2 - w / 2;
  } else if (place === 'left') {
    top = rect.top + rect.height / 2 - h / 2;
    left = rect.left - w - GAP_PX;
  } else {
    top = rect.top + rect.height / 2 - h / 2;
    left = rect.right + GAP_PX;
  }

  // Clamp to viewport so tooltip doesn't clip off-screen — matches
  // react-tooltip's collision avoidance closely enough for our uses.
  top = Math.max(GAP_PX, Math.min(top, window.innerHeight - h - GAP_PX));
  left = Math.max(GAP_PX, Math.min(left, window.innerWidth - w - GAP_PX));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

/**
 * Attaches hover handlers to every current + future `[data-tip]` trigger
 * inside `root`, and toggles the matching tooltip's `.show` class on
 * mouse enter/leave. Returns a cleanup that disconnects the observer;
 * per-trigger listeners collect naturally when the trigger elements
 * leave the DOM.
 */
export function tooltipBridge(root: ShadowRoot): Cleanup {
  const attached = new WeakSet<Element>();

  function attach(trigger: Element): void {
    if (attached.has(trigger)) return;
    const forId = trigger.getAttribute('data-for');
    if (!forId) return;
    attached.add(trigger);

    let shown: HTMLElement | null = null;

    const onEnter = () => {
      const tooltip = root.querySelector<HTMLElement>(`#${CSS.escape(forId)}`);
      if (!tooltip) return;
      positionTooltip(tooltip, trigger.getBoundingClientRect(), detectPlace(tooltip));
      tooltip.classList.add('show');
      shown = tooltip;
    };
    const onLeave = () => {
      if (shown) {
        shown.classList.remove('show');
        shown = null;
      }
    };

    trigger.addEventListener('mouseenter', onEnter);
    trigger.addEventListener('mouseleave', onLeave);
    // Touch: tap on trigger acts like an enter (widget doesn't use touch
    // patterns beyond this — keeps the bridge tiny).
    trigger.addEventListener('touchstart', onEnter, { passive: true });
  }

  // Initial scan for triggers already in the tree.
  for (const el of Array.from(root.querySelectorAll('[data-tip]'))) attach(el);

  // Widget re-renders may swap triggers in and out — watch the subtree
  // and attach handlers to newcomers.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.matches('[data-tip]')) attach(node);
        for (const child of Array.from(node.querySelectorAll('[data-tip]'))) {
          attach(child);
        }
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}
