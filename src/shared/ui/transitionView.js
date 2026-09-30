import { flushSync } from 'react-dom';

// Keep button and gesture navigation on the same accessible transition.
export function transitionView(update) {
  const apply = () => flushSync(update);
  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && typeof document.startViewTransition === 'function') {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}
