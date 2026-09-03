import type { RendererId, WidgetRenderer } from './WidgetRenderer';

/**
 * The host registers its concrete renderers here at startup; widget Clients
 * resolve them by id via the Widget dispatcher. This is the seam that lets
 * widget definitions stay free of the host's (Next/Sentry/uicore-coupled)
 * renderer implementations.
 */
const renderers = new Map<RendererId, WidgetRenderer>();

export function registerRenderer(renderer: WidgetRenderer): void {
  renderers.set(renderer.id, renderer);
}

export function getRenderer(id: RendererId): WidgetRenderer | undefined {
  return renderers.get(id);
}
