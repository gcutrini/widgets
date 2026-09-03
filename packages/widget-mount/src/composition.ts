/** The per-render live inputs a composer binds; handed to whichever renderer mounts the widget. */
export interface WidgetComposition {
  readonly props: Record<string, unknown>;
}

/**
 * Binds a widget's live state (realtime, auth, callbacks) onto its
 * server-derived props. A React hook — returns null until required data is
 * ready. Runs in the app's React for both renderers, since the web-component
 * can't call app hooks inside its own React.
 */
export type WidgetComposer<TServerProps = void> = (
  serverProps: TServerProps,
) => WidgetComposition | null;
