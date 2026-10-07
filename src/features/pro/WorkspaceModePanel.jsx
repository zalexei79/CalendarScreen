import React from 'react';
import { Sparkles } from 'lucide-react';
import ProWorkspaceActions from './ProWorkspaceActions';
import WalletEntry from './WalletEntry';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';

export default function WorkspaceModePanel({ proView, onModeChange, isLight, language, t, traderMode, onTraderChange, onWallet, walletAccess = false, walletLoading = false, onConnect, connected, metatrader, reconnect, onOffer }) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  return <div className={`workspace-mode-group ${isLight ? 'pro-light' : ''}`}>
    <section className={`workspace-mode-panel ${proView ? 'is-pro' : 'is-free'} ${traderMode ? 'is-trader' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Режим и инструменты DAYRIS','DAYRIS mode and tools','Mod și instrumente DAYRIS', "DAYRIS 模式和工具")}>
    <WalletEntry language={language} access={walletAccess} loading={walletLoading} onOpen={onWallet} onOffer={onOffer}/>
    <ProWorkspaceActions inPanel visible={proView} isLight={isLight} language={language} t={t} traderMode={traderMode} onTraderChange={onTraderChange} onWallet={onWallet} onConnect={onConnect} connected={connected} metatrader={metatrader} reconnect={reconnect} onOffer={onOffer}/>
    <div className="workspace-selector" role="group" aria-label={text('Режим DAYRIS','DAYRIS mode','Mod DAYRIS', "DAYRIS 模式")}>
      <button className="workspace-mode-toggle" type="button" role="switch" aria-checked={proView} aria-label={text('Режим PRO','PRO mode','Mod PRO', "PRO 模式")} onClick={onModeChange}>
        <span className="workspace-toggle-thumb" aria-hidden="true" />
        <span>FREE</span><span>PRO</span>
      </button>
      {proView && <button className="workspace-pro-info" type="button" onClick={onOffer} aria-label={text('Мой PRO: срок и возможности','My PRO: access and features','PRO-ul meu: acces și funcții', "我的 PRO：权限和功能")} title={t('proInfoAction')}><Sparkles aria-hidden="true" /></button>}
    </div>
    </section>
  </div>;
}
