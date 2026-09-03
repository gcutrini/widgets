import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emotionMirrorBridge } from '../emotion-mirror';

/**
 * The production regression this guards: emotion's speedy mode inserts
 * rules via sheet.insertRule — pure CSSOM writes that fire no DOM
 * mutation events. The bridge wraps insertRule on each emotion head sheet
 * so those inserts still reach the shadow mirror, on the next microtask,
 * without polling.
 */

function makeHost(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function makeEmotionTag(): HTMLStyleElement {
  const tag = document.createElement('style');
  tag.setAttribute('data-emotion', 'css');
  document.head.appendChild(tag);
  return tag;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('emotionMirrorBridge', () => {
  let cleanups: Array<() => void>;

  beforeEach(() => {
    cleanups = [];
    document.head
      .querySelectorAll('style[data-emotion]')
      .forEach((t) => t.remove());
  });

  afterEach(() => {
    cleanups.forEach((fn) => fn());
    document.body.innerHTML = '';
  });

  it('mirrors dev-mode text styles on head mutations', async () => {
    const root = makeHost();
    cleanups.push(emotionMirrorBridge(root));

    const tag = makeEmotionTag();
    tag.textContent = '.css-devmode{color:red}';
    await flushMicrotasks();

    const mirror = root.querySelector('style[data-emotion-mirror]');
    expect(mirror?.textContent).toContain('css-devmode');
  });

  it('picks up speedy-mode CSSOM inserts that fire no mutation events', async () => {
    const root = makeHost();
    const tag = makeEmotionTag();
    await flushMicrotasks();
    cleanups.push(emotionMirrorBridge(root));

    // Speedy signature: the rule lands in the CSSOM, textContent stays empty,
    // and no DOM mutation fires. The wrapped insertRule is the only trigger.
    tag.sheet!.insertRule('.css-speedy-only{color:rgb(1,2,3)}', 0);
    await flushMicrotasks();

    const mirror = root.querySelector('style[data-emotion-mirror]');
    expect(mirror?.textContent).toContain('css-speedy-only');
  });

  it('follows further CSSOM inserts on the next microtask (no polling)', async () => {
    const root = makeHost();
    const tag = makeEmotionTag();
    await flushMicrotasks();
    cleanups.push(emotionMirrorBridge(root));

    tag.sheet!.insertRule('.css-first{color:red}', 0);
    await flushMicrotasks();
    tag.sheet!.insertRule('.css-second{color:blue}', 0);
    await flushMicrotasks();

    const mirror = root.querySelector('style[data-emotion-mirror]');
    expect(mirror?.textContent).toContain('css-first');
    expect(mirror?.textContent).toContain('css-second');
  });

  it('mirrors an insert into a shadow opened before the emotion tag existed', async () => {
    // The dropdown case: the widget mounts, then react-select creates its
    // head sheet and inserts menu rules on first open.
    const root = makeHost();
    cleanups.push(emotionMirrorBridge(root));

    const tag = makeEmotionTag();
    await flushMicrotasks(); // observer wraps the new sheet
    tag.sheet!.insertRule('.css-on-open{color:green}', 0);
    await flushMicrotasks();

    const mirror = root.querySelector('style[data-emotion-mirror]');
    expect(mirror?.textContent).toContain('css-on-open');
  });

  it('stops mirroring after cleanup', async () => {
    const root = makeHost();
    const tag = makeEmotionTag();
    await flushMicrotasks();
    const dispose = emotionMirrorBridge(root);
    dispose();

    tag.sheet!.insertRule('.css-after-dispose{color:red}', 0);
    await flushMicrotasks();

    const mirror = root.querySelector('style[data-emotion-mirror]');
    expect(mirror?.textContent ?? '').not.toContain('css-after-dispose');
  });
});
