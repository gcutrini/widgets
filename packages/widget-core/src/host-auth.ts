/**
 * Neutral auth port between the host app and the legacy widgets.
 *
 * Every widget request goes through uicore's `security/methods` for its token.
 * `configureUicore()` in the widgets package (`kit/uicore-host.ts`) hands
 * uicore a token resolver and auth handlers that read the session through THIS
 * port, so the widgets package stays app-agnostic and works in both builds: the
 * Next app (reactComponent renderer) and the isolated esbuild bundle
 * (webComponent renderer). The host fills the port; uicore-host reads it.
 * Neither side of the port names uicore or the app's session internals.
 *
 * Resolution differs by module graph:
 *  - App / reactComponent: `src/components/widget/register-host.ts` calls
 *    `registerHostAuth`, setting the module `singleton`; uicore-host is in the
 *    same graph and reads it.
 *  - Bundle / webComponent: the bundle has its own copy of this module; the
 *    element's `configureHost()` registers the host impl into it before
 *    anything mounts (the renderer hands the ports across the DOM).
 */

export interface HostAuth {
  /** `false` only when the host is CERTAIN there is no session — a blip must not return false. */
  isSignedIn(): Promise<boolean>;
  /** End the host session (no-op when there is nothing to end). */
  logout(): void | Promise<void>;
}

let singleton: HostAuth | null = null;

/** Register the host impl; pass null to clear it. */
export const registerHostAuth = (auth: HostAuth | null): void => {
  singleton = auth;
};

export function getHostAuth(): HostAuth | null {
  return singleton;
}
