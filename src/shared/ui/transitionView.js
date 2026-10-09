import { flushSync } from 'react-dom';
import './WorkspaceTransition.css';

let finishTimer;
let sequence = 0;
let departing = [];

// Keep button and gesture navigation on the same accessible transition.
export function transitionView(update) {
  const current = ++sequence;
  window.clearTimeout(finishTimer);
  departing.forEach(animation => animation.cancel());
  departing = [];
  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const arrive = () => {
    if (current !== sequence) return;
    departing.forEach(animation => animation.cancel());
    departing = [];
    root.dataset.workspaceTransition = 'active';
    flushSync(update);
    finishTimer = window.setTimeout(() => {
      if (current === sequence) delete root.dataset.workspaceTransition;
    }, reduced ? 0 : 560);
  };
  const surface = document.querySelector('.wallet-panel-enter, .capital-panel, .calendar-section');
  if (reduced || !surface?.animate) { arrive(); return; }
  delete root.dataset.workspaceTransition;
  // A short live departure bridges the content change. Unlike native screenshot
  // transitions, the new screen stays interactive throughout its longer arrival.
  departing = [surface].map(node => node.animate([
    { opacity: 1, translate: '0 0' },
    { opacity: .84, translate: '0 -4px' },
  ], { duration: 160, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }));
  Promise.all(departing.map(animation => animation.finished.catch(() => {}))).then(arrive);
}
