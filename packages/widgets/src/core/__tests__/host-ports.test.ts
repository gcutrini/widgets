import { describe, it, expect, afterEach } from 'vitest';
import { registerHostAuth, getHostAuth, type HostAuth } from '../host-auth';
import { registerHostConfig, getHostConfig, type HostConfig } from '../host-config';

const auth: HostAuth = { isSignedIn: async () => true, logout: () => {} };
const config: HostConfig = {
  apiBaseUrl: '/proxy',
  idpBaseUrl: 'https://idp.test',
  oauth2ClientId: 'cid',
  timeApiUrl: 'https://time.test',
};

describe('host ports', () => {
  afterEach(() => {
    registerHostAuth(null);
    registerHostConfig(null);
  });

  it('read the registered impl', () => {
    registerHostAuth(auth);
    registerHostConfig(config);
    expect(getHostAuth()).toBe(auth);
    expect(getHostConfig()).toBe(config);
  });

  it('return null when nothing is registered', () => {
    expect(getHostAuth()).toBeNull();
    expect(getHostConfig()).toBeNull();
  });

  it('registering null clears the impl', () => {
    registerHostAuth(auth);
    registerHostAuth(null);
    expect(getHostAuth()).toBeNull();
  });
});
