/**
 * Shared skeleton primitives for widget loading states. Rendered inside
 * the shadow root (dynamic-import `loading` slot or pre-data gates), so
 * the classes can't leak. Widgets compose `.skeleton` blocks sized
 * with inline styles.
 */
export const css = `
.skeleton {
  background: linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0.06) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
  border-radius: 4px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
