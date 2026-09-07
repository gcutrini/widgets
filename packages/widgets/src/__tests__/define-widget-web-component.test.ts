import { describe, it, expect, vi, beforeEach } from 'vitest';
// The element under test lives in the web-components package; its imports
// resolve through this workspace. React/ReactDOM are injected by contract,
// so fakes exercise the element's visit/DOM state machine without React 17.
import { defineWidgetWebComponent } from '../../../web-components/src/element/defineWidgetWebComponent.js';
import { webComponentTag } from '../core/manifest';
import { WIDGET_PAINTED_EVENT } from '../core/widget-painted';
import type { WidgetManifest } from '../core/manifest';

const renderCalls: Array<{ container: Element; commit: () => void }> = [];
const unmountCalls: Element[] = [];

const FakeReact = {
  createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
    type,
    props,
    children,
  }),
  Component: class {},
};
const FakeReactDOM = {
  render: (_tree: unknown, container: Element, callback?: () => void) => {
    renderCalls.push({ container, commit: callback ?? (() => {}) });
  },
  unmountComponentAtNode: (container: Element) => {
    unmountCalls.push(container);
  },
};

const manifest = {
  name: 'element-demo',
  load: async () => ({ default: () => null }),
} as unknown as WidgetManifest;
const tag = webComponentTag('element-demo');

const makeElement = async () => {
  await defineWidgetWebComponent({
    React: FakeReact,
    ReactDOM: FakeReactDOM,
    manifest,
  });
  const el = document.createElement(tag) as HTMLElement & {
    mount: (args?: {
      hostAuth?: unknown;
      hostConfig?: unknown;
      props?: Record<string, unknown>;
    }) => void;
    setProps: (props: Record<string, unknown>) => void;
    unmount: () => void;
  };
  document.body.appendChild(el);
  return el;
};

beforeEach(() => {
  // Wipe the DOM first — removing a prior test's element fires its
  // disconnectedCallback, which must not land in this test's counters.
  document.body.innerHTML = '';
  renderCalls.length = 0;
  unmountCalls.length = 0;
});

describe('the element visit lifecycle', () => {
  it('mount() renders once connected; unmount() tears down and is idempotent', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    expect(renderCalls).toHaveLength(1);

    el.unmount();
    expect(unmountCalls).toHaveLength(1);
    el.unmount();
    expect(unmountCalls).toHaveLength(2); // safe to repeat — no throw, same target
    expect(renderCalls).toHaveLength(1); // no re-render from unmounting
  });

  it('setProps replaces and renders only inside an open visit', async () => {
    const el = await makeElement();
    el.setProps({ a: 1 }); // before mount: no-op
    expect(renderCalls).toHaveLength(0);

    el.mount({ props: { a: 1 } });
    el.setProps({ b: 2 });
    expect(renderCalls).toHaveLength(2);

    el.unmount();
    el.setProps({ c: 3 }); // retired: no-op
    expect(renderCalls).toHaveLength(2);
  });

  it('a new mount() after unmount() renders a fresh tree into the same shadow', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    const firstContainer = renderCalls[0].container;
    el.unmount();
    el.mount({ props: { a: 2 } });
    expect(renderCalls).toHaveLength(2);
    expect(renderCalls[1].container).toBe(firstContainer);
    expect(el.shadowRoot).not.toBeNull();
  });

  it('unmount() after disconnectedCallback already tore down stays safe', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.remove(); // disconnectedCallback: unmounts the tree, keeps the visit
    expect(unmountCalls).toHaveLength(1);
    el.unmount(); // renderer cleanup arrives after — must not throw
    expect(unmountCalls).toHaveLength(2);
  });

  it('announces widget-painted once per visit, after the first commit', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const el = await makeElement();
      const painted = vi.fn();
      el.addEventListener(WIDGET_PAINTED_EVENT, painted);

      el.mount({ props: { a: 1 } });
      renderCalls[0].commit();
      expect(painted).toHaveBeenCalledTimes(1);

      el.setProps({ a: 2 });
      renderCalls[1].commit();
      expect(painted).toHaveBeenCalledTimes(1); // once per visit

      el.unmount();
      el.mount({ props: { a: 3 } });
      renderCalls[2].commit();
      expect(painted).toHaveBeenCalledTimes(2); // a new visit announces again
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the painted event bubbles to ancestors', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);
      const el = await makeElement();
      wrapper.appendChild(el);
      const painted = vi.fn();
      wrapper.addEventListener(WIDGET_PAINTED_EVENT, painted);
      el.mount({ props: { a: 1 } });
      renderCalls[0].commit();
      expect(painted).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
