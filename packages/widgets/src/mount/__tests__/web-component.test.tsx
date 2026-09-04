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
const mountCalls: Array<{
  hostAuth?: HostAuth | null;
  hostConfig?: HostConfig | null;
  props?: Record<string, unknown>;
}> = [];
const setPropsCalls: Array<Record<string, unknown>> = [];
class FakeWidget extends HTMLElement {
  mount(args: {
    hostAuth?: HostAuth | null;
    hostConfig?: HostConfig | null;
    props?: Record<string, unknown>;
  }) {
    mountCalls.push(args);
  }
  setProps(props: Record<string, unknown>) {
    setPropsCalls.push(props);
  }
}
customElements.define(webComponentTag('demo'), FakeWidget);

describe('web-component renderer', () => {
  const realAppend = document.head.appendChild.bind(document.head);

  beforeEach(() => {
    mountCalls.length = 0;
    setPropsCalls.length = 0;
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

  it('hands the host ports and the initial props in one mount call', async () => {
    const webComponent = createWebComponentRenderer({ bundleBasePath: '/web-components' });
    render(<webComponent.Mount manifest={manifest} composition={{ props: { a: 1 } }} />);
    await waitFor(() => expect(mountCalls).toHaveLength(1));
    expect(mountCalls[0].hostAuth).toBe(auth);
    expect(mountCalls[0].hostConfig).toBe(config);
    expect(mountCalls[0].props).toMatchObject({ a: 1 });
    expect(setPropsCalls).toHaveLength(0);
  });

  it('later prop changes go through setProps, never a second mount', async () => {
    const webComponent = createWebComponentRenderer({ bundleBasePath: '/web-components' });
    const { rerender } = render(
      <webComponent.Mount manifest={manifest} composition={{ props: { a: 1 } }} />,
    );
    await waitFor(() => expect(mountCalls).toHaveLength(1));
    rerender(
      <webComponent.Mount manifest={manifest} composition={{ props: { a: 2 } }} />,
    );
    await waitFor(() => expect(setPropsCalls).toHaveLength(1));
    expect(setPropsCalls[0]).toMatchObject({ a: 2 });
    expect(mountCalls).toHaveLength(1);
  });
});
