import {useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {createMonthShakeDetector,hasMonthMotionData,monthShakeScreenAngle} from './monthShakeModel.js';
import {getMonthShakeState,subscribeMonthShake,supportsMonthShake,reportMonthShake} from './monthShake.js';

export default function useMonthShake({active,onPrevious,onNext}) {
  const state = useSyncExternalStore(subscribeMonthShake,getMonthShakeState);
  const actions = useRef(null);
  const detector = useMemo(() => createMonthShakeDetector({sensitivity:state.sensitivity}),[state.sensitivity]);
  actions.current = {active,onPrevious,onNext};
  useEffect(() => {
    if (!state.enabled || !active || !supportsMonthShake()) return undefined;
    let listening = false, timer = 0, hasData = false;
    function reading(event) {
      if (!actions.current.active || document.hidden) return;
      const angle = monthShakeScreenAngle();
      const direction = detector.push(event,performance.now(),angle);
      if (!hasData && hasMonthMotionData(event)) {
        hasData = true; clearTimeout(timer); reportMonthShake('active');
      }
      if (!direction) return;
      // Only a recognized gesture needs DOM guards. No page-wide queries,
      // style writes, RAF or React updates for ordinary sensor samples.
      if (document.getElementById('root')?.inert || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
        || [...document.querySelectorAll('dialog[open],[aria-modal="true"],.dayris-date-menu,.dayris-status-menu,.calendar-currency-menu')]
          .some(node => !node.closest('[hidden],[aria-hidden="true"],dialog:not([open])') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')) {
        detector.reset(); return;
      }
      // Let the mounted calendar complete its two-page transition before the
      // month state changes. Busy transitions consume further requests too.
      const surface = document.querySelector('.calendar-section:not(.calendar-month-preview)');
      if (surface && !surface.dispatchEvent(new CustomEvent('dayris-calendar-step',{cancelable:true,detail:{direction}}))) return;
      if (direction === 'prev') actions.current.onPrevious();
      if (direction === 'next') actions.current.onNext();
    }
    function visibility() {
      const visible = !document.hidden;
      if (visible === listening) return;
      listening = visible; hasData = false; detector.reset(); clearTimeout(timer);
      if (visible) {
        window.addEventListener('devicemotion',reading,{passive:true});
        timer = window.setTimeout(() => reportMonthShake('noData'),5000);
      } else window.removeEventListener('devicemotion',reading);
    }
    const reset = () => detector.reset();
    visibility();
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('orientationchange',reset);
    window.screen.orientation?.addEventListener('change',reset);
    return () => {
      clearTimeout(timer); detector.reset();
      window.removeEventListener('devicemotion',reading);
      document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('orientationchange',reset);
      window.screen.orientation?.removeEventListener('change',reset);
    };
  },[state.enabled,detector,active]);
}
