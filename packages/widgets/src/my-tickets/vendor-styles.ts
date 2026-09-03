import { sheet as myTickets } from '../kit/vendor-css/my-orders-tickets-widget';

/**
 * Style dependencies for the My Orders & Tickets widget.
 *
 * The widget is MUI-based: its runtime styles come from emotion (mirrored
 * into the shadow by the emotion bridge), and its static stylesheet
 * carries no bootstrap/font-awesome classes and no `url()` references —
 * so the sheet set is just its own CSS.
 */

export const myTicketsSheets = [myTickets] as const;

/**
 * Hand-authored override adopted into the shadow root.
 *
 * The widget renders each filter section — and the "Filters" panel title —
 * as a MUI `<CardHeader>` whose title is Typography `variant="h5"`
 * (~1.6rem / 25.6px in MUI's default scale), which is oversized for a
 * filter label. Shrink it to the 16px baseline, scoped to the filter
 * dropdown so any `CardHeader` on the ticket cards keeps its own size.
 * The real fix belongs upstream — see UPSTREAM.md entry 9.
 */
export const myTicketsStyles = [
  `[class*="filterListContainer___"] .MuiCardHeader-title {
    font-size: 1rem;
    line-height: 1.4;
  }`,
] as const;
