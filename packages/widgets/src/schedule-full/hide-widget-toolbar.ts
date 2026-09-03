/**
 * The host renders its own MUI schedule controls (`ScheduleToolbar`) and the
 * schedule shows no heading, so the widget's built-in title and button-bar
 * (timezone / 12-24h / Print / Share / view toggle) are both redundant —
 * hide them.
 *
 * The title uses the widget's stable `widget-title` hook. The button-bar has
 * no stable class, so target it hash-agnostically: its wrapper is the only
 * element with a `buttonGroup___*` block as a DIRECT child (rather than a
 * build-specific hashed class, which would break on every widget rebuild).
 */
export const css: string = `
.widget-title,
:has(> [class^="buttonGroup___"]) {
  display: none !important;
}
`;
