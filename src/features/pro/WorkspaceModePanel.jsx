import React, { useId, useRef, useState } from 'react';
import { Info, ChartNoAxesCombined } from 'lucide-react';
import ProWorkspaceActions from './ProWorkspaceActions';
import WalletEntry from './WalletEntry';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';
import './WorkspacePass.css';

export default function WorkspaceModePanel({ todayAction, hideSelector = false, proView, onModeChange, isLight, language, currency, t, traderMode, onTraderChange, onWallet, onCapital, walletAccess = false, walletLoading = false, onConnect, connected, metatrader, reconnect, onOffer }) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  const financialProActive = proView && walletAccess && !walletLoading;
  return <div className={`workspace-mode-group ${isLight ? 'pro-light' : ''}`}>
    <section className={`workspace-mode-panel ${hideSelector ? "compact-tool-rail" : ""} ${proView ? 'is-pro' : 'is-free'} ${traderMode ? 'is-trader' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Режим и инструменты DAYRIS','DAYRIS mode and tools','Mod și instrumente DAYRIS', "DAYRIS 模式和工具")}>
    {financialProActive && <WalletEntry language={language} access onOpen={onWallet} onOffer={onOffer}/>}
    {financialProActive && onCapital && <button type="button" className="workspace-capital-entry" onClick={onCapital} title={t('capitalHomeTitle')} aria-label={t('capitalHomeTitle')}><ChartNoAxesCombined aria-hidden="true"/><span>{text('Инвестиции','Investments','Investiții','投资')}</span></button>}
    {todayAction}
    <ProWorkspaceActions inPanel visible={proView} isLight={isLight} language={language} currency={currency} t={t} traderMode={traderMode} onTraderChange={onTraderChange} onWallet={onWallet} onConnect={onConnect} connected={connected} metatrader={metatrader} reconnect={reconnect} onOffer={onOffer}/>
    {!hideSelector && <WorkspaceModeSelector proView={proView} onModeChange={onModeChange} language={language} t={t} onOffer={onOffer}/> }
    </section>
  </div>;
}

export function WorkspaceModeSelector({proView, onModeChange, language, t, onOffer}) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  const [hasSwitched, setHasSwitched] = useState(false);
  const orbitId = `pass-orbit-${useId().replace(/:/g, '')}`;
  const pointerBounds = useRef(null);
  function enterPass(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    pointerBounds.current = event.currentTarget.getBoundingClientRect();
  }
  function reflectPointer(event) {
    const bounds = pointerBounds.current;
    if (!bounds || event.pointerType !== 'mouse') return;
    const clamp = value => Math.max(0, Math.min(100, value));
    event.currentTarget.style.setProperty('--pass-light-x', `${clamp((event.clientX - bounds.left) / bounds.width * 100)}%`);
    event.currentTarget.style.setProperty('--pass-light-y', `${clamp((event.clientY - bounds.top) / bounds.height * 100)}%`);
  }
  function leavePass(event) {
    pointerBounds.current = null;
    event.currentTarget.style.removeProperty('--pass-light-x');
    event.currentTarget.style.removeProperty('--pass-light-y');
  }
  return (<div className={`workspace-selector workspace-pass ${proView ? 'is-pro' : 'is-free'}${hasSwitched ? ' has-switched' : ''}`} role="group" aria-label={text('Режим DAYRIS','DAYRIS mode','Mod DAYRIS', "DAYRIS 模式")} onPointerEnter={enterPass} onPointerMove={reflectPointer} onPointerLeave={leavePass}>
      <svg className="workspace-pass-orbit" viewBox="0 0 104 44" fill="none" aria-hidden="true">
        <defs><linearGradient id={orbitId} x1="8" y1="35" x2="96" y2="8" gradientUnits="userSpaceOnUse"><stop stopColor="var(--pass-metal)" stopOpacity=".12"/><stop offset=".25" stopColor="var(--pass-metal)" stopOpacity=".7"/><stop offset=".45" stopColor="var(--pass-metal)" stopOpacity=".18"/><stop offset=".75" stopColor="var(--pass-metal)"/><stop offset="1" stopColor="var(--pass-metal)" stopOpacity=".25"/></linearGradient></defs>
        <ellipse className="workspace-orbit-shadow" cx="50" cy="22.7" rx="47" ry="17" transform="rotate(-10 50 22.7)"/>
        <ellipse className="workspace-orbit-metal" cx="50" cy="22" rx="47" ry="17" transform="rotate(-10 50 22)" stroke={`url(#${orbitId})`}/>
        <path d="M 18 37 C 44 48 94 34 98 15"/>
      </svg>
      <button className="workspace-mode-toggle" type="button" role="switch" aria-checked={proView} aria-label={text('Режим PRO','PRO mode','Mod PRO', "PRO 模式")} onClick={() => { setHasSwitched(true); onModeChange(); }}>
        <span className="workspace-pass-face" aria-hidden="true">{hasSwitched && <span key={proView ? 'pro' : 'free'} className="workspace-pass-sheen"/>}</span>
        <svg className="workspace-pass-facet" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 1.5 5 3v7l-5 3-5-3v-7z"/><path d="m3 4.5 5 3 5-3M8 7.5v7M8 1.5v6"/></svg>
        <span key={proView ? 'pro-label' : 'free-label'} className="workspace-pass-label">{proView ? 'PRO' : 'FREE'}</span>
      </button>
      <button className="workspace-pro-info" type="button" onClick={onOffer} aria-label={t('proInfoAction')} title={t('proInfoAction')}><Info aria-hidden="true" /></button>
    </div>);
}
