import { describe, it, expect, vi } from 'vitest';
import { Component, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import type { WidgetManifest } from '@openeventkit/widget-core';
import { createShadowReactRenderer } from '../renderers/shadow-react';

/**
 * jsdom notes: style mechanics (constructable vs <style> fallback) are owned
 * by widget-core's widget-shadow tests — nothing here asserts on styles.
 * useIsomorphicLayoutEffect resolves to useLayoutEffect, which testing-library
 * flushes synchronously, so no waitFor is needed; resolveComponent stays
 * synchronous (no lazy loading) for the same reason.
 */

const manifestOf = (overrides: Partial<WidgetManifest> = {}): WidgetManifest =>
  ({
    name: 'demo',
    load: async () => ({ default: () => null }),
    ...overrides,
  }) as WidgetManifest;

function Probe(props: Record<string, unknown>) {
  if (typeof props.onRender === 'function') {
    (props.onRender as (p: Record<string, unknown>) => void)(props);
  }
  return <div data-testid="probe" />;
}

describe('createShadowReactRenderer', () => {
  it('attaches a shadow to the host element and portals the widget into its container', () => {
    const renderer = createShadowReactRenderer({ resolveComponent: () => Probe });
    const manifest = manifestOf({
      elementTag: 'section',
      elementAttrs: { 'data-widget': 'demo' },
    });
    const { container } = render(
      <renderer.Mount manifest={manifest} composition={{ props: {} }} />,
    );

    const host = container.querySelector('section[data-widget="demo"]') as HTMLElement;
    expect(host).toBeTruthy();
    expect(host.shadowRoot).toBeTruthy();
    // The widget rendered inside the shadow, not the light DOM.
    expect(host.shadowRoot!.querySelector('[data-testid="probe"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="probe"]')).toBeNull();
  });

  it('hands wrapShadowTree the tree and the actual shadow root', () => {
    const wrapShadowTree = vi.fn((tree: ReactNode, _root: ShadowRoot) => (
      <div data-testid="wrapper">{tree}</div>
    ));
    const renderer = createShadowReactRenderer({
      resolveComponent: () => Probe,
      wrapShadowTree,
    });
    const { container } = render(
      <renderer.Mount manifest={manifestOf()} composition={{ props: {} }} />,
    );

    const host = container.querySelector('div') as HTMLElement;
    expect(wrapShadowTree).toHaveBeenCalledTimes(1);
    expect(wrapShadowTree.mock.calls[0][1]).toBe(host.shadowRoot);
    const wrapper = host.shadowRoot!.querySelector('[data-testid="wrapper"]');
    expect(wrapper?.querySelector('[data-testid="probe"]')).toBeTruthy();
  });

  it('wraps the whole mount in the injected Boundary and contains render errors', () => {
    class Boundary extends Component<
      { manifest: WidgetManifest; children: ReactNode },
      { failed: boolean }
    > {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? (
          <div data-testid="fallback">{this.props.manifest.name}</div>
        ) : (
          this.props.children
        );
      }
    }
    const Throwing = () => {
      throw new Error('widget render error');
    };
    const renderer = createShadowReactRenderer({
      resolveComponent: () => Throwing,
      Boundary,
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByTestId } = render(
      <renderer.Mount manifest={manifestOf()} composition={{ props: {} }} />,
    );
    spy.mockRestore();
    expect(getByTestId('fallback').textContent).toBe('demo');
  });

  it('resolves the component once per manifest across prop changes', () => {
    const resolveComponent = vi.fn(() => Probe);
    const renderer = createShadowReactRenderer({ resolveComponent });
    const manifest = manifestOf();
    const { rerender } = render(
      <renderer.Mount manifest={manifest} composition={{ props: { a: 1 } }} />,
    );
    rerender(
      <renderer.Mount manifest={manifest} composition={{ props: { a: 2 } }} />,
    );
    expect(resolveComponent).toHaveBeenCalledTimes(1);
  });

  it('hands the widget mutation-safe props (in-place mutation cannot reach the source)', () => {
    const source = { data: { a: 1 }, list: [1, 2] };
    const renderer = createShadowReactRenderer({ resolveComponent: () => Probe });
    render(
      <renderer.Mount
        manifest={manifestOf()}
        composition={{
          props: {
            ...source,
            onRender: (props: Record<string, unknown>) => {
              (props.data as { a: number }).a = 99;
              (props.list as number[]).push(3);
            },
          },
        }}
      />,
    );
    expect(source.data.a).toBe(1);
    expect(source.list).toEqual([1, 2]);
  });

  it('applies manifest.wrapTree around the widget inside the shadow', () => {
    const renderer = createShadowReactRenderer({ resolveComponent: () => Probe });
    const manifest = manifestOf({
      wrapTree: (children) => <div data-testid="wraptree">{children}</div>,
    });
    const { container } = render(
      <renderer.Mount manifest={manifest} composition={{ props: {} }} />,
    );
    const host = container.querySelector('div') as HTMLElement;
    const wrap = host.shadowRoot!.querySelector('[data-testid="wraptree"]');
    expect(wrap?.querySelector('[data-testid="probe"]')).toBeTruthy();
  });

  it('runs bridge cleanups on unmount (shadow disposed)', () => {
    const cleanup = vi.fn();
    const renderer = createShadowReactRenderer({ resolveComponent: () => Probe });
    const manifest = manifestOf({ bridges: [() => cleanup] });
    const { unmount } = render(
      <renderer.Mount manifest={manifest} composition={{ props: {} }} />,
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
