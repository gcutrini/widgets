import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { registerHostAuth, type HostAuth } from '../../core/host-auth';
import { registerHostConfig, type HostConfig } from '../../core/host-config';
import { webComponentTag, type WidgetManifest } from '../../core';
import { createWebComponentRenderer } from '../renderers/web-component';

const auth: HostAuth = { isSignedIn: async () => true, logout: () => {} };
const config: HostConfig = {
  apiBaseUrl: '/proxy',
  idpBaseUrl: 'https://idp.test',
  oauth2ClientId: 'cid',
  timeApiUrl: 'https://time.test',
};
const manifest = { name: 'demo', load: async () => ({ default: () => null }) } as unknown as WidgetManifest;

// The element the bundle would define — records the host handshake.
const calls: string[] = [];
let receivedPorts: { hostAuth?: HostAuth | null; hostConfig?: HostConfig | null } | null = null;
let receivedProps: Record<string, unknown> | null = null;
class FakeWidget extends HTMLElement {
  configureHost(ports: { hostAuth?: HostAuth | null; hostConfig?: HostConfig | null }) {
    calls.push('configureHost');
    receivedPorts = ports;
  }
  setProps(props: Record<string, unknown>) {
    calls.push('setProps');
    receivedProps = props;
  }
}
customElements.define(webComponentTag('demo'), FakeWidget);

describe('web-component renderer', () => {
  const realAppend = document.head.appendChild.bind(document.head);

  beforeEach(() => {
    calls.length = 0;
    receivedPorts = null;
    receivedProps = null;
    registerHostAuth(auth);
    registerHostConfig(config);
    // Let the module <script> "load" immediately — jsdom never fetches it.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      (node as HTMLScriptElement).onload?.(new Event('load'));
      return node;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.appendChild = realAppend;
    registerHostAuth(null);
    registerHostConfig(null);
  });

  it('hands the host ports to the element before the props', async () => {
    const webComponent = createWebComponentRenderer({ bundleBasePath: '/web-components' });
    render(<webComponent.Mount manifest={manifest} composition={{ props: { a: 1 } }} />);
    await waitFor(() => expect(calls).toContain('setProps'));
    expect(calls.indexOf('configureHost')).toBeLessThan(calls.indexOf('setProps'));
    expect(receivedPorts?.hostAuth).toBe(auth);
    expect(receivedPorts?.hostConfig).toBe(config);
    expect(receivedProps).toMatchObject({ a: 1 });
  });
});
