import React from 'react';
import { ChartCandlestick, Link2, Sparkles, Wallet } from 'lucide-react';
import './ProPresentation.css';

export default function ProWorkspaceActions({ visible, isLight, language, t, traderMode, onTraderChange, onWallet, onConnect, connected, onOffer }) {
  const locale = String(language || 'ru').toLowerCase().split('-')[0];
  const traderLabel = ['en', 'md', 'ro'].includes(locale) ? 'Trader' : 'Трейдер';
  return (
    <div className={`pro-actions-reveal ${visible ? 'is-visible' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={locale === 'en' ? 'PRO workspace controls' : locale === 'ro' ? 'Comenzi PRO' : 'Управление PRO'} aria-hidden={!visible} inert={visible ? undefined : ''}>
      <div className="pro-actions-clip">
        <div className="pro-actions" aria-label="DAYRIS PRO">
          <button type="button" className="pro-control pro-control-wallet" onClick={onWallet} title={t('walletProHint')} aria-label={t('walletLabel')}>
            <Wallet aria-hidden="true" /><span>{t('walletLabel')}</span>
          </button>
          <button type="button" role="switch" aria-checked={traderMode} aria-label={t('traderModeLabel')} title={t('traderModeHint')} onClick={onTraderChange} className="pro-control pro-control-trader">
            <ChartCandlestick aria-hidden="true" /><span>{traderLabel}</span>
            <span className="pro-control-toggle" aria-hidden="true"><span /></span>
          </button>
          {traderMode && <button type="button" className="pro-control pro-control-connect" title={connected ? t('connected') : t('connectPlatform')} aria-label={`cTrader · ${connected ? t('connected') : t('connectPlatform')}`} onClick={onConnect}>
            <Link2 aria-hidden="true" /><span>cTrader</span><i data-connected={connected} aria-hidden="true" />
          </button>}
          <button type="button" className="pro-control pro-control-info" title={t('proInfoAction')} aria-label={t('proInfoAction')} onClick={onOffer}><Sparkles aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  );
}
