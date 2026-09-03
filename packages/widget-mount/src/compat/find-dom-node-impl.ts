/**
 * Standalone re-implementation of React's removed `findDOMNode`: read the
 * class instance's fiber (`_reactInternals`) and return the first host (DOM)
 * node in its subtree — exactly what React's own `findDOMNode` did.
 *
 * Shared by both consumers so there is one implementation:
 *   - `./find-dom-node` — patches it onto the react-dom module object at
 *     runtime (for widgets that call `ReactDOM.findDOMNode` off the namespace,
 *     e.g. react-transition-group@1's `CSSTransitionGroupChild`).
 *   - `./react-dom-with-find-dom-node` — re-exports it as a named export so a
 *     static `import { findDOMNode } from 'react-dom'` resolves at build time
 *     (react-select@2), via the scoped alias rule in
 *     `packages/widgets/src/kit/webpack-compat.ts`.
 */

type HostNode = Element | Text;

function isHostNode(value: unknown): value is HostNode {
  const nodeType = (value as { nodeType?: number } | null)?.nodeType;
  return nodeType === 1 || nodeType === 3;
}

/** Depth-first search for the first host node rendered by a fiber's subtree. */
function findHostNode(fiber: any): HostNode | null {
  if (!fiber) return null;
  if (isHostNode(fiber.stateNode)) return fiber.stateNode;
  for (let child = fiber.child; child; child = child.sibling) {
    const found = findHostNode(child);
    if (found) return found;
  }
  return null;
}

export function findDOMNode(componentOrElement: any): HostNode | null {
  if (componentOrElement == null) return null;
  if (isHostNode(componentOrElement)) return componentOrElement;
  const fiber =
    componentOrElement._reactInternals ??
    componentOrElement._reactInternalFiber ??
    null;
  return findHostNode(fiber);
}
