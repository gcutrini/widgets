import { describe, it, expect, afterEach } from 'vitest';
import { registerHostAuth, getHostAuth, type HostAuth } from '../host-auth';

const auth: HostAuth = { isSignedIn: async () => true, logout: () => {} };

describe('host-auth port', () => {
  afterEach(() => registerHostAuth(null));

  it('reads the registered impl', () => {
    registerHostAuth(auth);
    expect(getHostAuth()).toBe(auth);
  });

  it('returns null when nothing is registered', () => {
    expect(getHostAuth()).toBeNull();
  });

  it('registering null clears the impl', () => {
    registerHostAuth(auth);
    registerHostAuth(null);
    expect(getHostAuth()).toBeNull();
  });
});
