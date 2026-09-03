import { describe, it, expect, vi } from 'vitest';
import { useMemo } from 'react';
import { render, renderHook } from '@testing-library/react';
import { mutationSafeProps, useMutationSafeProps } from '../mutation-safe-props';

describe('mutationSafeProps', () => {
  it('shallow-copies plain-object props so a widget mutation does not leak', () => {
    const summit = { id: 1, dates_with_events: ['2026-08-07'] };
    const out = mutationSafeProps({ summitData: summit });

    expect(out.summitData).not.toBe(summit);
    (out.summitData as Record<string, unknown>).dates = [{ date: () => {} }];
    expect((summit as Record<string, unknown>).dates).toBeUndefined();
  });

  it('copies array props into a new array (equal contents, new identity)', () => {
    const events = [{ id: 1 }, { id: 2 }];
    const out = mutationSafeProps({ eventsData: events });

    expect(out.eventsData).not.toBe(events);
    expect(out.eventsData).toEqual(events);
  });

  it('passes functions (callbacks) through by identity', () => {
    const triggerAction = vi.fn();
    const out = mutationSafeProps({ triggerAction });
    expect(out.triggerAction).toBe(triggerAction);
  });

  it('passes primitives and null through unchanged', () => {
    const out = mutationSafeProps({ title: 'x', count: 3, flag: true, empty: null });
    expect(out).toEqual({ title: 'x', count: 3, flag: true, empty: null });
  });

  it('does NOT shallow-copy non-plain objects (preserves class instances)', () => {
    const map = new Map([['k', 'v']]);
    const date = new Date(0);
    const out = mutationSafeProps({ map, date });

    expect(out.map).toBe(map);
    expect(out.date).toBe(date);
  });

  it('is a shallow copy — nested references are shared (documented limitation)', () => {
    const nested = { name: 'Track 1' };
    const summit = { tracks: [nested] };
    const out = mutationSafeProps({ summitData: summit });

    expect(out.summitData).not.toBe(summit);
    expect((out.summitData as { tracks: unknown[] }).tracks).toBe(summit.tracks);
    expect((out.summitData as { tracks: unknown[] }).tracks[0]).toBe(nested);
  });
});

describe('useMutationSafeProps', () => {
  it('returns the same object while the source props are shallow-equal', () => {
    const events = [{ id: 1 }];
    const cb = () => {};
    const { result, rerender } = renderHook(
      ({ p }) => useMutationSafeProps(p),
      { initialProps: { p: { events, cb } as Record<string, unknown> } },
    );
    const first = result.current;
    rerender({ p: { events, cb } });
    expect(result.current).toBe(first);
  });

  it('re-clones when a source prop reference changes', () => {
    const cb = () => {};
    const { result, rerender } = renderHook(
      ({ p }) => useMutationSafeProps(p),
      { initialProps: { p: { events: [{ id: 1 }], cb } as Record<string, unknown> } },
    );
    const first = result.current;
    rerender({ p: { events: [{ id: 2 }], cb } }); // events ref changed
    expect(result.current).not.toBe(first);
    expect(result.current.events).toEqual([{ id: 2 }]);
  });

  it('preserves a widget mutation on the clone while the source is unchanged', () => {
    const summit = { name: 'S' };
    const { result, rerender } = renderHook(
      ({ p }) => useMutationSafeProps(p),
      { initialProps: { p: { summit } as Record<string, unknown> } },
    );
    (result.current.summit as Record<string, unknown>).dates = ['d1'];
    rerender({ p: { summit } });
    expect((result.current.summit as Record<string, unknown>).dates).toEqual(['d1']);
  });
});

describe('memoized widget element (the re-render firewall)', () => {
  it('does not re-render the widget subtree when host re-renders with the same data', () => {
    const childRenders = vi.fn();
    function Child(_props: Record<string, unknown>) {
      childRenders();
      return null;
    }
    function Host({ data, tick }: { data: unknown; tick: number }) {
      const isolated = useMutationSafeProps({ data });
      const content = useMemo(() => <Child {...isolated} />, [isolated]);
      return <div data-tick={tick}>{content}</div>;
    }

    const data = [{ id: 1 }];
    const { rerender } = render(<Host data={data} tick={0} />);
    expect(childRenders).toHaveBeenCalledTimes(1);

    rerender(<Host data={data} tick={1} />);
    expect(childRenders).toHaveBeenCalledTimes(1);

    rerender(<Host data={[{ id: 2 }]} tick={2} />);
    expect(childRenders).toHaveBeenCalledTimes(2);
  });
});
