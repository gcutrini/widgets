/**
 * The uicore/widget add-to-schedule toggles are native `<button>` elements,
 * which default to `cursor: default`. The schedule widgets get a pointer for
 * free from bootstrap's `button { cursor: pointer }` reset — but upcoming-events
 * and live-event don't adopt bootstrap, so their buttons show the arrow. This
 * restores the pointer for them, matching bootstrap's behavior (disabled buttons
 * keep the default). Element selector, so a uicore rebuild can't break it.
 */
import type { VendorSheet } from '@openeventkit/widget-core/vendor-sheet';

export const css: string = `
button:not([disabled]):not(.is-disabled) {
  cursor: pointer;
}
`;

/**
 * Same rule as a VendorSheet, for `scopedPortalCssBridge` — full-schedule's
 * event-detail popover renders its CircleButton into a light-DOM container
 * (`#popovers-container`) outside the shadow, so the shadow-adopted rule can't
 * reach it; the bridge mirrors this into `document.head`, scoped to the popover.
 */
export const sheet: VendorSheet = { id: 'button-cursor', css, fontFaces: '' };
