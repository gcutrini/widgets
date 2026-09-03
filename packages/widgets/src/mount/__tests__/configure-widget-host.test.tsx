import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * configureWidgetHost is the host's single entry point: it fills the ports,
 * registers the renderers and configures uicore in one call, in the right
 * order — a host cannot configure uicore before the config port is filled.
 */
const calls: string[] = [];

vi.mock('../../core/host-auth', () => ({
  registerHostAuth: vi.fn(() => calls.push('auth')),
}));
vi.mock('../../core/host-config', () => ({
  registerHostConfig: vi.fn(() => calls.push('config')),
  getHostConfig: vi.fn(() => ({ apiBaseUrl: '/x', idpBaseUrl: '', oauth2ClientId: '', timeApiUrl: '' })),
}));
vi.mock('../../lib/uicore-host', () => ({
  configureUicore: vi.fn(() => calls.push('uicore')),
}));
vi.mock('../registry', () => ({
  registerRenderer: vi.fn(() => calls.push('renderer')),
}));

import { configureWidgetHost } from '../configure-widget-host';

describe('configureWidgetHost', () => {
  beforeEach(() => { calls.length = 0; });

  it('fills the config port before configuring uicore', () => {
    configureWidgetHost({
      config: { apiBaseUrl: '/x', idpBaseUrl: '', oauth2ClientId: '', timeApiUrl: '' },
      auth: { isSignedIn: async () => false, logout: async () => {} },
      renderers: [{ id: 'a' } as never, { id: 'b' } as never],
    });
    expect(calls.indexOf('config')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('config')).toBeLessThan(calls.indexOf('uicore'));
    expect(calls.filter((c) => c === 'renderer')).toHaveLength(2);
    expect(calls).toContain('auth');
  });
});
