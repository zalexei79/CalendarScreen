import React from 'react';
import { Sparkles } from 'lucide-react';
import ProWorkspaceActions from './ProWorkspaceActions';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';

export default function WorkspaceModePanel({ proView, onModeChange, isLight, language, t, traderMode, onTraderChange, onWallet, onConnect, connected, metatrader, reconnect, onOffer }) {
  const text = (r,e,m) => platformText(language,r,e,m);
  return <section className={`workspace-mode-panel ${proView ? 'is-pro' : 'is-free'} ${isLight ? 'pro-light' : ''}`} aria-label={text('Режим и инструменты DAYRIS','DAYRIS mode and tools','Mod și instrumente DAYRIS')}>
    <button type="button" role="switch" aria-checked={proView} aria-label={text('Режим PRO','PRO mode','Mod PRO')} onClick={onModeChange} className="workspace-selector"><span data-active={!proView}>FREE</span><span data-active={proView}>✦ PRO</span></button>
    {!proView && <div className="workspace-free-caption"><span>{text('Личные финансы','Personal finances','Finanțe personale')}</span><button type="button" onClick={onOffer} aria-label={t('proInfoAction')}><Sparkles aria-hidden="true" /></button></div>}
    <ProWorkspaceActions inPanel visible={proView} isLight={isLight} language={language} t={t} traderMode={traderMode} onTraderChange={onTraderChange} onWallet={onWallet} onConnect={onConnect} connected={connected} metatrader={metatrader} reconnect={reconnect} onOffer={onOffer}/>
  </section>;
}
