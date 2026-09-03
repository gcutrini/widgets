/**
 * Full neutralization of legacy `react-transition-group@1`
 * (`CSSTransitionGroup`) list animations under React 19.
 *
 * The lite-schedule widget renders its list inside a
 * `CSSTransitionGroup transitionName="items"` (the only transitionName in
 * any widget dist). The library's two-step fade — add `.items-enter`
 * (opacity 0.01), then add `.items-enter-active` one animation frame
 * later — breaks under React 19: the second step is guarded by an
 * internal `mounted` flag the render timing can leave false, sticking
 * items at opacity 0.01 forever. An earlier keyframe-based shim kept the
 * fade but fought the healthy path (double animation), replayed on every
 * realtime update (shimmer), and left the leave path untouched.
 *
 * Neutralize the mechanism instead of preserving the animation:
 *   - enter/appear: force full opacity with animations and transitions
 *     off — items are simply visible, in every timing scenario
 *   - leave: hide instantly; the widget sets `transitionLeaveTimeout:
 *     100`, and RTG v1 unmounts leaving nodes on that timer regardless
 *     of CSS, so removal stays deterministic and nothing ghosts
 *
 * The legacy 1s fade is gone by design. The shim becomes deletable once
 * lite-schedule-widget drops CSSTransitionGroup upstream (tracked with
 * the react-bootstrap work in that repo).
 */
export const transitionGroupFadeFix = `
.items-appear, .items-enter {
  opacity: 1 !important;
  animation: none !important;
  transition: none !important;
}
.items-leave {
  opacity: 0 !important;
  transition: none !important;
}
`;
