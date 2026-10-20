import React from 'react';
import { Sparkles, ChartNoAxesCombined } from 'lucide-react';
import ProWorkspaceActions from './ProWorkspaceActions';
import WalletEntry from './WalletEntry';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';

export default function WorkspaceModePanel({ hideSelector = false, proView, onModeChange, isLight, language, currency, t, traderMode, onTraderChange, onWallet, onCapital, walletAccess = false, walletLoading = false, onConnect, connected, metatrader, reconnect, onOffer }) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  const financialProActive = proView && !traderMode && walletAccess && !walletLoading;
  return <div className={`workspace-mode-group ${isLight ? 'pro-light' : ''}`}>
    <section className={`workspace-mode-panel ${hideSelector ? "compact-tool-rail" : ""} ${proView ? 'is-pro' : 'is-free'} ${traderMode ? 'is-trader' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Режим и инструменты DAYRIS','DAYRIS mode and tools','Mod și instrumente DAYRIS', "DAYRIS 模式和工具")}>
    {financialProActive && <WalletEntry language={language} access onOpen={onWallet} onOffer={onOffer}/>}
    {financialProActive && onCapital && <button type="button" className="workspace-capital-entry" onClick={onCapital} title={t('capitalHomeTitle')} aria-label={t('capitalHomeTitle')}><ChartNoAxesCombined aria-hidden="true"/><span>{text('Инвестиции','Investments','Investiții','投资')}</span></button>}
    <ProWorkspaceActions inPanel visible={proView} isLight={isLight} language={language} currency={currency} t={t} traderMode={traderMode} onTraderChange={onTraderChange} onWallet={onWallet} onConnect={onConnect} connected={connected} metatrader={metatrader} reconnect={reconnect} onOffer={onOffer}/>
    {!hideSelector && <WorkspaceModeSelector proView={proView} onModeChange={onModeChange} language={language} t={t} onOffer={onOffer}/> }
    </section>
  </div>;
}

export function WorkspaceModeSelector({proView, onModeChange, language, t, onOffer}) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  return (<div className="workspace-selector" role="group" aria-label={text('Режим DAYRIS','DAYRIS mode','Mod DAYRIS', "DAYRIS 模式")}>
      <button className="workspace-mode-toggle" type="button" role="switch" aria-checked={proView} aria-label={text('Режим PRO','PRO mode','Mod PRO', "PRO 模式")} onClick={onModeChange}>
        <span className="workspace-toggle-thumb" aria-hidden="true" />
        <span>FREE</span><span>PRO</span>
      </button>
      {proView && <button className="workspace-pro-info" type="button" onClick={onOffer} aria-label={text('Мой PRO: срок и возможности','My PRO: access and features','PRO-ul meu: acces și funcții', "我的 PRO：权限和功能")} title={t('proInfoAction')}><Sparkles aria-hidden="true" /></button>}
    </div>);
}
