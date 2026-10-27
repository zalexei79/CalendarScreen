import {useEffect,useState} from 'react';
import {createMonthShakeDetector,hasMonthMotionData,monthShakeScreenAngle} from './monthShakeModel.js';
import {reportMonthShake} from './monthShake.js';

// An explicit, local, ten-second test. It can confirm sensor delivery while
// settings are open, but it never calls calendar navigation or logs readings.
export default function useMonthShakeTest({enabled,sensitivity}) {
  const [running,setRunning] = useState(false), [phase,setPhase] = useState('idle');
  useEffect(() => {
    if (!running || !enabled) { if (running) { setRunning(false); setPhase('idle'); } return undefined; }
    const detector = createMonthShakeDetector({sensitivity});
    let hasData = false, matched = false;
    setPhase('waiting');
    function reading(event) {
      if (document.hidden) return;
      if (!hasData && hasMonthMotionData(event)) { hasData = true; setPhase('sensing'); reportMonthShake('active'); }
      const direction = detector.push(event,performance.now(),monthShakeScreenAngle());
      if (direction) { matched = true; setPhase(direction); }
    }
    function visibility() { if (document.hidden) { setRunning(false); setPhase('idle'); } }
    const timer = window.setTimeout(() => {
      setRunning(false);
      if (!matched) setPhase(hasData?'weak':'noData');
      if (!hasData) reportMonthShake('noData');
    },10000);
    window.addEventListener('devicemotion',reading,{passive:true});
    document.addEventListener('visibilitychange',visibility);
    return () => {
      clearTimeout(timer); window.removeEventListener('devicemotion',reading);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[running,enabled,sensitivity]);
  function start() { setPhase('waiting'); setRunning(true); }
  function stop() { setRunning(false); }
  return {running,phase,start,stop};
}
