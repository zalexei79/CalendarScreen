import { flushSync } from 'react-dom';
import './WorkspaceTransition.css';

let finishTimer;

// Keep button and gesture navigation on the same accessible transition.
export function transitionView(update) {
  window.clearTimeout(finishTimer);
  const root = document.documentElement;
  root.dataset.workspaceTransition = 'active';
  // Native full-page snapshots intercept quick follow-up touches. Animate the
  // live destination instead: navigation and input remain immediate throughout.
  flushSync(update);
  finishTimer = window.setTimeout(() => delete root.dataset.workspaceTransition, 300);
}
