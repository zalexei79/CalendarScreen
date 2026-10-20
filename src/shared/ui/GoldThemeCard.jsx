import React, {useId} from 'react';
import {Crown,LockKeyhole,Check,ChevronRight} from 'lucide-react';
import {GOLD_THEME_COPY} from './goldThemeCopy.js';

export default function GoldThemeCard({locale,selected,active,loading,onSelect,onPro}) {
  const copy=GOLD_THEME_COPY[locale]||GOLD_THEME_COPY.en;
  const id=useId();
  return <button type="button" className={`settings-gold-card${selected?' is-selected':''}`} data-theme-option="gold" aria-label={copy.name} aria-pressed={selected} aria-describedby={id} disabled={loading} onClick={active?onSelect:onPro}>
    <span className="settings-gold-art" aria-hidden="true"><Crown size={23}/><i/><i/><i/></span>
    <span className="settings-gold-copy"><span className="settings-gold-heading"><strong>{copy.name}</strong><small>PRO</small></span><span>{copy.description}</span><small id={id}>{loading?copy.loading:active?copy.active:copy.locked}</small></span>
    {selected?<Check size={18} aria-hidden="true"/>:active?<ChevronRight size={18} aria-hidden="true"/>:<LockKeyhole size={17} aria-hidden="true"/>}
  </button>;
}
