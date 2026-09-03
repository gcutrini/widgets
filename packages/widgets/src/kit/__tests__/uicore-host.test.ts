import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHostAuth } from '@openeventkit/widget-core/host-auth';
import { registerHostConfig } from '@openeventkit/widget-core/host-config';

const { setConfig, setAccessTokenResolver, setAuthHandlers, emitWidgetAuthError } = vi.hoisted(() => ({
  setConfig: vi.fn(),
  setAccessTokenResolver: vi.fn(),
  setAuthHandlers: vi.fn(),
  emitWidgetAuthError: vi.fn(),
}));

vi.mock('openstack-uicore-foundation/lib/utils/config', () => ({ setConfig }));
vi.mock('openstack-uicore-foundation/lib/security/methods', () => ({
  setAccessTokenResolver,
  setAuthHandlers,
}));
vi.mock('@openeventkit/widget-core/widget-auth-error', () => ({ emitWidgetAuthError }));

import { configureUicore } from '../uicore-host';

const HOST_CONFIG = {
  apiBaseUrl: '/proxy',
  idpBaseUrl: 'https://idp.test',
  oauth2ClientId: 'cid',
  timeApiUrl: 'https://time.test',
};

const registered = () => ({
  resolver: setAccessTokenResolver.mock.calls[0][0] as () => Promise<string>,
  handlers: setAuthHandlers.mock.calls[0][0] as {
    initLogOut: () => void;
    authErrorHandler: (d: { status: number }) => void;
  },
});

describe('configureUicore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerHostConfig(HOST_CONFIG);
  });

  it('hands uicore the HostConfig values', () => {
    configureUicore();
    expect(setConfig).toHaveBeenCalledWith(HOST_CONFIG);
  });

  it('the resolver returns the presence placeholder while signed in, and throws only on a certain signed-out', async () => {
    const isSignedIn = vi.fn();
    registerHostAuth({ isSignedIn, logout: vi.fn() });
    configureUicore();
    const { resolver } = registered();

    isSignedIn.mockResolvedValueOnce(true);
    await expect(resolver()).resolves.toBe('session-cookie');
    isSignedIn.mockResolvedValueOnce(false);
    await expect(resolver()).rejects.toThrow('signed out');
  });

  it('initLogOut delegates to the host logout', () => {
    const logout = vi.fn();
    registerHostAuth({ isSignedIn: vi.fn(), logout });
    configureUicore();
    registered().handlers.initLogOut();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('401/403 raise the widget auth-error event, other codes are ignored', () => {
    registerHostAuth({ isSignedIn: vi.fn(), logout: vi.fn() });
    configureUicore();
    const { handlers } = registered();
    handlers.authErrorHandler({ status: 401 });
    handlers.authErrorHandler({ status: 403 });
    handlers.authErrorHandler({ status: 500 });
    expect(emitWidgetAuthError).toHaveBeenCalledTimes(2);
    expect(emitWidgetAuthError).toHaveBeenCalledWith({ status: 401 });
    expect(emitWidgetAuthError).toHaveBeenCalledWith({ status: 403 });
  });

  it('with no HostAuth registered the resolver returns the placeholder and initLogOut is a no-op', async () => {
    registerHostAuth(null);
    configureUicore();
    const { resolver, handlers } = registered();
    await expect(resolver()).resolves.toBe('session-cookie');
    expect(() => handlers.initLogOut()).not.toThrow();
  });

  it('the handlers read the ports at call time, so HostAuth may be registered later', async () => {
    registerHostAuth({ isSignedIn: async () => false, logout: vi.fn() });
    configureUicore();
    const { resolver } = registered();
    registerHostAuth({ isSignedIn: async () => true, logout: vi.fn() });
    await expect(resolver()).resolves.toBe('session-cookie');
  });
});
