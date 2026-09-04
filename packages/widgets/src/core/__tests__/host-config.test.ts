import { describe, it, expect, afterEach } from 'vitest';
import { registerHostConfig, getHostConfig, type HostConfig } from '../host-config';

const config: HostConfig = {
  apiBaseUrl: '/proxy',
  idpBaseUrl: 'https://idp.test',
  oauth2ClientId: 'cid',
  timeApiUrl: 'https://time.test',
};

describe('host-config port', () => {
  afterEach(() => registerHostConfig(null));

  it('reads the registered impl', () => {
    registerHostConfig(config);
    expect(getHostConfig()).toBe(config);
  });

  it('returns null when nothing is registered', () => {
    expect(getHostConfig()).toBeNull();
  });

  it('registering null clears the impl', () => {
    registerHostConfig(config);
    registerHostConfig(null);
    expect(getHostConfig()).toBeNull();
  });
});
