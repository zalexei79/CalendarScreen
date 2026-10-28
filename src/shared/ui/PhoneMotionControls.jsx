import React, { useSyncExternalStore } from 'react';
import GlassParallaxControl from './GlassParallaxControl.jsx';
import MonthShakeControl from './MonthShakeControl.jsx';
import { localeKey } from '../i18n/locale.js';
import './PhoneMotionControls.css';

const QUERY = '(pointer: coarse)';
const LABEL = { ru:'Движение телефона', uk:'Рух телефона', en:'Phone motion', ro:'Mișcarea telefonului', zh:'手机动作' };
function subscribe(listener) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const touchInput = () => window.matchMedia(QUERY).matches;

export default function PhoneMotionControls({ language, theme, active, loading }) {
  const phone = useSyncExternalStore(subscribe, touchInput, () => false);
  if (!phone) return null;
  return <div className="settings-phone-motion" role="group" aria-label={LABEL[localeKey(language)]}>
    {active && !loading && ['gold','emerald'].includes(theme) && <GlassParallaxControl language={language} theme={theme}/>}
    <MonthShakeControl language={language}/>
  </div>;
}
