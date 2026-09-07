/**
 * Event contract for a web component's first paint. The element
 * dispatches this on itself one animation frame after the first React
 * commit of a visit (mount() → first render), so hosts can swap a skeleton
 * for the real content. Bubbles on purpose: the interested listener is
 * usually an ancestor wrapper, not the element itself. Fires once per
 * visit — a later unmount()/mount() cycle announces again.
 */

export const WIDGET_PAINTED_EVENT = 'widget-painted';
