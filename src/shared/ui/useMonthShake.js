import {useEffect,useRef,useSyncExternalStore} from 'react';
import {createMonthShakeDetector} from './monthShakeModel.js';
import {getMonthShakeState,subscribeMonthShake,supportsMonthShake,reportMonthShake} from './monthShake.js';

export default function useMonthShake({active,onPrevious,onNext}) {
  const state = useSyncExternalStore(subscribeMonthShake,getMonthShakeState);
  const actions = useRef(null), detector = useRef(null);
  actions.current = {active,onPrevious,onNext};
  if (!detector.current) detector.current = createMonthShakeDetector();
  useEffect(() => {
    if (!state.enabled || !active || !supportsMonthShake()) return undefined;
    let listening = false, timer = 0, hasData = false;
    function reading(event) {
      if (!actions.current.active || document.hidden) return;
      const angle = window.screen.orientation?.angle ?? (Number.isFinite(window.orientation)?window.orientation:0);
      const direction = detector.current.push(event,performance.now(),angle);
      if (!hasData && [event.acceleration,event.accelerationIncludingGravity].some(vector => vector && ['x','y','z'].every(axis => Number.isFinite(vector[axis])))) {
        hasData = true; clearTimeout(timer); reportMonthShake('active');
      }
      if (!direction) return;
      // Only a recognized gesture needs DOM guards. No page-wide queries,
      // style writes, RAF or React updates for ordinary sensor samples.
      if (document.getElementById('root')?.inert || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
        || document.querySelector('dialog[open],[aria-modal="true"],.dayris-date-menu,.dayris-status-menu,.calendar-currency-menu')) {
        detector.current.reset(); return;
      }
      if (direction === 'prev') actions.current.onPrevious();
      if (direction === 'next') actions.current.onNext();
    }
    function visibility() {
      const visible = !document.hidden;
      if (visible === listening) return;
      listening = visible; hasData = false; detector.current.reset(); clearTimeout(timer);
      if (visible) {
        window.addEventListener('devicemotion',reading,{passive:true});
        timer = window.setTimeout(() => reportMonthShake('noData'),5000);
      } else window.removeEventListener('devicemotion',reading);
    }
    const reset = () => detector.current.reset();
    visibility();
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('orientationchange',reset);
    window.screen.orientation?.addEventListener('change',reset);
    return () => {
      clearTimeout(timer); detector.current.reset();
      window.removeEventListener('devicemotion',reading);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('orientationchange',reset);
      window.screen.orientation?.removeEventListener('change',reset);
    };
  },[state.enabled,active]);
}
