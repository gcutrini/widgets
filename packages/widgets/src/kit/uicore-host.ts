/// <reference path="widget-modules.d.ts" />
import { setConfig } from 'openstack-uicore-foundation/lib/utils/config';
import {
  setAccessTokenResolver,
  setAuthHandlers,
} from 'openstack-uicore-foundation/lib/security/methods';
import { getHostAuth } from '@openeventkit/widget-core/host-auth';
import { getHostConfig } from '@openeventkit/widget-core/host-config';
import { emitWidgetAuthError } from '@openeventkit/widget-core/widget-auth-error';

/**
 * uicore wants a non-empty bearer string. The host's proxy re-authenticates
 * every call from its own session, so this is a presence placeholder, not a
 * token. Exported so the host can pin it against its own session vocabulary.
 */
export const SESSION_PRESENT = 'session-cookie';

/**
 * Hands uicore the host's settings, token source and auth handlers, read from
 * the HostConfig and HostAuth ports. Call once per module graph (this package
 * is the only importer of uicore in the host graph, so the setters reach the
 * instance the widgets use), before the first uicore read. The handlers read
 * the ports at call time, so the host may fill HostAuth later.
 *
 * Importing this evaluates uicore's security/methods, which logs a
 * "browser-only superagent" notice when evaluated on the server. Keep the
 * import synchronous anyway: a lazy import could resolve after the first
 * client render already read uicore's config.
 */
export function configureUicore(): void {
  const cfg = getHostConfig();
  if (cfg) {
    setConfig({
      apiBaseUrl: cfg.apiBaseUrl,
      idpBaseUrl: cfg.idpBaseUrl,
      oauth2ClientId: cfg.oauth2ClientId,
      timeApiUrl: cfg.timeApiUrl,
    });
  }

  // uicore's contract: resolve a non-empty bearer while a session exists,
  // throw when there is none (the widget catches and logs out). Only a CERTAIN
  // signed-out throws; an unconfirmed session (a blip) returns the placeholder
  // and lets the proxied call decide, so a hiccup never logs a signed-in user
  // out.
  setAccessTokenResolver(async () => {
    const auth = getHostAuth();
    if (auth && !(await auth.isSignedIn())) {
      throw new Error('uicore: signed out');
    }
    return SESSION_PRESENT;
  });

  setAuthHandlers({
    initLogOut: () => {
      void getHostAuth()?.logout();
    },
    // uicore only calls this for 401 and 403. The handler runs outside React,
    // so it raises the widget auth-error event and the host's dialog owns the
    // user-facing treatment.
    authErrorHandler: ({ status }: { status?: number }) => {
      if (status === 401 || status === 403) emitWidgetAuthError({ status });
    },
  });
}
