import React, { useRef } from 'react';
import { Info, ChevronDown, ChartNoAxesCombined } from 'lucide-react';
import ProWorkspaceActions from './ProWorkspaceActions';
import WalletEntry from './WalletEntry';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';
import './WorkspacePass.css';

export default function WorkspaceModePanel({ todayAction, hideSelector = false, proView, isLight, language, currency, t, traderMode, onTraderChange, onWallet, onCapital, walletAccess = false, walletLoading = false, onConnect, connected, metatrader, reconnect, onOffer }) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  const financialProActive = proView && walletAccess && !walletLoading;
  return <div className={`workspace-mode-group ${isLight ? 'pro-light' : ''}`}>
    <section className={`workspace-mode-panel ${hideSelector ? "compact-tool-rail" : ""} ${proView ? 'is-pro' : 'is-free'} ${traderMode ? 'is-trader' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Режим и инструменты DAYRIS','DAYRIS mode and tools','Mod și instrumente DAYRIS', "DAYRIS 模式和工具")}>
    {financialProActive && <WalletEntry language={language} access onOpen={onWallet} onOffer={onOffer}/>}
    {financialProActive && onCapital && <button type="button" className="workspace-capital-entry" onClick={onCapital} title={t('capitalHomeTitle')} aria-label={t('capitalHomeTitle')}><ChartNoAxesCombined aria-hidden="true"/><span>{text('Инвестиции','Investments','Investiții','投资')}</span></button>}
    {todayAction}
    <ProWorkspaceActions inPanel visible={proView} isLight={isLight} language={language} currency={currency} t={t} traderMode={traderMode} onTraderChange={onTraderChange} onWallet={onWallet} onConnect={onConnect} connected={connected} metatrader={metatrader} reconnect={reconnect} onOffer={onOffer}/>
    {!hideSelector && <WorkspaceModeSelector proView={proView} language={language} t={t} onOffer={onOffer}/> }
    </section>
  </div>;
}

export function WorkspaceModeSelector({proView, language, t, onOffer, onTools, toolsOpen, toolsId, toolsLabel, triggerRef, traderMode}) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
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
  return (<div className={`workspace-selector workspace-pass ${proView ? 'is-pro' : 'is-free'}`} role="group" aria-label={text('Тариф DAYRIS','DAYRIS plan','Plan DAYRIS', "DAYRIS 订阅")} onPointerEnter={enterPass} onPointerMove={reflectPointer} onPointerLeave={leavePass}>
      <span className="workspace-pass-orbit" aria-hidden="true"/>
      <button ref={triggerRef} className="workspace-mode-toggle" type="button" aria-label={proView ? 'DAYRIS PRO' : 'DAYRIS FREE'} title={onTools ? toolsLabel : t('proInfoAction')} aria-haspopup={onTools ? 'dialog' : undefined} aria-expanded={onTools ? toolsOpen : undefined} aria-controls={onTools ? toolsId : undefined} data-trader={traderMode||undefined} onClick={onTools||onOffer}>
        <span className="workspace-pass-face" aria-hidden="true"/>
        <span key={proView ? 'pro-label' : 'free-label'} className="workspace-pass-label">{proView ? 'PRO' : 'FREE'}{onTools&&<ChevronDown aria-hidden="true"/>}</span>
      </button>
      <button className="workspace-pro-info" type="button" onClick={onOffer} aria-label={t('proInfoAction')} title={t('proInfoAction')}><Info aria-hidden="true" /></button>
    </div>);
}
