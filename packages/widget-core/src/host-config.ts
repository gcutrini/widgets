/**
 * Neutral host-config port. The host fills it; the widgets package reads it and
 * hands the values to uicore (see widgets' uicore-host) — so the mount layer
 * never imports the app's env / proxy modules. Values point at the host's
 * same-origin proxy so uicore's calls ride the session cookie.
 *
 * Resolution differs by module graph, as for HostAuth: the app registers the
 * module singleton; a web-component bundle has its own copy of this module,
 * filled by the element's `configureHost()` before anything mounts.
 */

export interface HostConfig {
  /** Same-origin base uicore composes its API URLs against. */
  apiBaseUrl: string;
  /**
   * IDP base URL and OAuth2 client id. uicore uses them only to build its own
   * login and logout URLs, which the injected auth handlers bypass; kept so any
   * uicore path that still builds one gets a real IDP, not undefined.
   */
  idpBaseUrl: string;
  oauth2ClientId: string;
  /** Server-time endpoint uicore's clock reads. */
  timeApiUrl: string;
  /**
   * Base URL the widget asset binaries (fonts, images) are served under.
   * Vendor sheets reference them through the __WIDGET_ASSETS__ placeholder,
   * which createWidgetShadow substitutes with this value. Empty (the default)
   * means the host serves packages/widgets/assets at the site root, e.g.
   * /fonts/... and /widget-css/....
   */
  assetBaseUrl?: string;
}

let config: HostConfig | null = null;

/** Register the host settings; pass null to clear them. */
export const registerHostConfig = (c: HostConfig | null): void => {
  config = c;
};

export function getHostConfig(): HostConfig | null {
  return config;
}
