import { useCallback, useRef, type Ref } from 'react';

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

/**
 * A mount's handle on its host element, shared with the caller: `setRef` goes
 * on the rendered element and fans the node out to the mount's own `ref` and
 * to the forwarded one, so `<SomeWidget ref={…}>` behaves like any React
 * component's ref without the mount depending on whether a caller passed one.
 */
export function useHostRef<T extends HTMLElement = HTMLElement>(
  forwarded: Ref<HTMLElement> | undefined,
): {
  ref: { current: T | null };
  setRef: (node: T | null) => void;
} {
  const ref = useRef<T | null>(null);
  const setRef = useCallback(
    (node: T | null) => {
      ref.current = node;
      assignRef(forwarded, node);
    },
    [forwarded],
  );
  return { ref, setRef };
}
