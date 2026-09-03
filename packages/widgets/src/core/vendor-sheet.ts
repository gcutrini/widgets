/**
 * A vendor stylesheet emitted by `@openeventkit/widgets`' `scripts/generate-assets.mjs`
 * as a TypeScript module (its `src/lib/vendor-css/*`). The `css`
 * text is adopted into widget shadow roots via constructable
 * stylesheets; `fontFaces` holds the extracted `@font-face` blocks
 * (adopted sheets silently ignore them) which `createWidgetShadow` injects into
 * `document.head` once per sheet id. url() references to asset binaries carry
 * the __WIDGET_ASSETS__ placeholder, substituted with the host's
 * HostConfig.assetBaseUrl at use time (empty base = site-root paths).
 */
export interface VendorSheet {
  /** Stable identity — used for sheet caching and font-face dedup. */
  id: string;
  css: string;
  fontFaces: string;
}

import { getHostConfig } from './host-config';

/**
 * Vendor sheets reference asset binaries through the __WIDGET_ASSETS__
 * placeholder (written at generation time). Substitute the host's base URL
 * at use time; empty base yields site-root paths like /fonts/....
 * Every injection path — adopted css, font-faces, portal sheets, scoped
 * portal css — must run its text through this.
 */
export function resolveAssetUrls(css: string): string {
  if (!css.includes('__WIDGET_ASSETS__')) return css;
  const base = (getHostConfig()?.assetBaseUrl ?? '').replace(/\/+$/, '');
  return css.replaceAll('__WIDGET_ASSETS__', base);
}
