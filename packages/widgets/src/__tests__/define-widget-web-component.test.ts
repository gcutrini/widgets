import { describe, it, expect, vi, beforeEach } from 'vitest';
// The element under test lives in the web-components package; its imports
// resolve through this workspace. React/createRoot are injected by contract,
// so fakes exercise the element's visit/DOM state machine without a real React.
import { defineWidgetWebComponent } from '../../../web-components/src/element/defineWidgetWebComponent.js';
import { webComponentTag } from '../core/manifest';
import { WIDGET_PAINTED_EVENT } from '../core/widget-painted';
import type { WidgetManifest } from '../core/manifest';

interface FakeTree {
  type: unknown;
  props: Record<string, unknown> | null;
  children: FakeTree[];
}
interface FakeRoot {
  container: Element;
  render: (tree: FakeTree) => void;
  unmount: () => void;
  renders: FakeTree[];
  unmounts: number;
}

const roots: FakeRoot[] = [];

const FakeReact = {
  createElement: (type: unknown, props: Record<string, unknown> | null, ...children: FakeTree[]): FakeTree => ({
    type,
    props,
    children,
  }),
  Component: class {},
  useLayoutEffect: () => {},
};
const fakeCreateRoot = (container: Element): FakeRoot => {
  const root: FakeRoot = {
    container,
    renders: [],
    unmounts: 0,
    render: (tree) => root.renders.push(tree),
    unmount: () => {
      root.unmounts += 1;
      if (root.unmounts > 1) throw new Error('root already unmounted');
    },
  };
  roots.push(root);
  return root;
};

const manifest = {
  name: 'element-demo',
  load: async () => ({ default: () => null }),
} as unknown as WidgetManifest;
const tag = webComponentTag('element-demo');

const makeElement = async () => {
  await defineWidgetWebComponent({
    React: FakeReact,
    createRoot: fakeCreateRoot,
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

// The FirstCommitSignal's onCommit inside a recorded tree — invoking it
// simulates the tree's first commit.
const commitOf = (tree: FakeTree) => {
  const signal = tree.children[0];
  expect(signal.props).toHaveProperty('onCommit');
  return signal.props!.onCommit as () => void;
};

beforeEach(() => {
  // Wipe the DOM first — removing a prior test's element fires its
  // disconnectedCallback, which must not land in this test's counters.
  document.body.innerHTML = '';
  roots.length = 0;
});

describe('the element visit lifecycle on React roots', () => {
  it('mount() creates one root per visit; setProps renders on the same root', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.setProps({ a: 2 });
    el.setProps({ a: 3 });
    expect(roots).toHaveLength(1);
    expect(roots[0].renders).toHaveLength(3);
  });

  it('unmount() unmounts the root exactly once, even when repeated', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.unmount();
    el.unmount(); // must not reach the root again — a second root.unmount throws
    expect(roots).toHaveLength(1);
    expect(roots[0].unmounts).toBe(1);
  });

  it('setProps outside an open visit is a no-op', async () => {
    const el = await makeElement();
    el.setProps({ a: 1 });
    expect(roots).toHaveLength(0);
    el.mount({ props: { a: 1 } });
    el.unmount();
    el.setProps({ a: 2 });
    expect(roots[0].renders).toHaveLength(1);
  });

  it('a new mount() after unmount() creates a NEW root on the same container', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.unmount();
    el.mount({ props: { a: 2 } });
    expect(roots).toHaveLength(2);
    expect(roots[1].container).toBe(roots[0].container);
    expect(el.shadowRoot).not.toBeNull();
  });

  it('disconnect-then-unmount() — the normal removal sequence — stays safe', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.remove(); // disconnectedCallback unmounts the root
    expect(roots[0].unmounts).toBe(1);
    el.unmount(); // renderer cleanup arrives after — must not touch the dead root
    expect(roots[0].unmounts).toBe(1);
  });

  it('a reconnect within an open visit gets a fresh root with the retained props', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    el.remove();
    document.body.appendChild(el); // connectedCallback → _renderIfReady
    expect(roots).toHaveLength(2);
    expect(roots[1].renders).toHaveLength(1);
  });

  it('the commit signal sits below the error boundary', async () => {
    const el = await makeElement();
    el.mount({ props: { a: 1 } });
    const tree = roots[0].renders[0];
    // WidgetErrorBoundary > FirstCommitSignal > ShadowRootContext.Provider
    expect(tree.props).toHaveProperty('onError');
    expect(tree.children[0].props).toHaveProperty('onCommit');
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
      commitOf(roots[0].renders[0])();
      expect(painted).toHaveBeenCalledTimes(1);

      el.setProps({ a: 2 });
      commitOf(roots[0].renders[1])();
      expect(painted).toHaveBeenCalledTimes(1); // once per visit

      el.unmount();
      el.mount({ props: { a: 3 } });
      commitOf(roots[1].renders[0])();
      expect(painted).toHaveBeenCalledTimes(2); // a new visit announces again
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a reconnect within a visit does not re-announce', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    try {
      const el = await makeElement();
      const painted = vi.fn();
      el.addEventListener(WIDGET_PAINTED_EVENT, painted);
      el.mount({ props: { a: 1 } });
      commitOf(roots[0].renders[0])();
      el.remove();
      document.body.appendChild(el);
      commitOf(roots[1].renders[0])(); // fresh root re-commits; the flag absorbs it
      expect(painted).toHaveBeenCalledTimes(1);
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
      commitOf(roots.at(-1)!.renders[0])();
      expect(painted).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
