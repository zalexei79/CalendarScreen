import React from 'react';
import { ChartCandlestick, Link2, Monitor, Sparkles, Wallet } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';

export default function ProWorkspaceActions({ visible, isLight, language, t, traderMode, onTraderChange, onWallet, onConnect, connected, metatrader = {}, reconnect, onOffer }) {
  const text = (r, e, m) => platformText(language, r, e, m);
  return <div className={`pro-actions-reveal ${visible ? 'is-visible' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Управление PRO', 'PRO workspace controls', 'Comenzi PRO')} aria-hidden={!visible} inert={visible ? undefined : ''}>
    <div className="pro-actions-clip"><div className="pro-actions" aria-label="DAYRIS PRO">
      <button type="button" className="pro-control pro-control-wallet" onClick={onWallet} title={t('walletProHint')} aria-label={t('walletLabel')}><Wallet aria-hidden="true" /><span>{t('walletLabel')}</span></button>
      <button type="button" role="switch" aria-checked={traderMode} aria-label={t('traderModeLabel')} title={t('traderModeHint')} onClick={onTraderChange} className="pro-control pro-control-trader"><ChartCandlestick aria-hidden="true" /><span>{text('Трейдер', 'Trader', 'Trader')}</span><span className="pro-control-toggle" aria-hidden="true"><span /></span></button>
      {traderMode && [['ctrader', 'cTrader', Link2, connected && !reconnect], ['mt5', 'MT5', Monitor, metatrader.connected]].map(([id, name, Icon, ready]) => {
        const status = id === 'ctrader' && reconnect ? text('Нужен повторный вход', 'Reconnect required', 'Reconectare necesară') : ready ? text('Подключён', 'Connected', 'Conectat') : text('Не подключён', 'Not connected', 'Neconectat');
        return <button key={id} type="button" className="pro-control pro-control-connect pro-control-platform" title={`${name} · ${status}`} aria-label={`${name} · ${status} · ${text('открыть меню', 'open menu', 'deschide meniul')}`} onClick={() => onConnect(id)}><Icon aria-hidden="true" /><span>{name}</span><i data-connected={Boolean(ready)} aria-hidden="true" /></button>;
      })}
      <button type="button" className="pro-control pro-control-info" title={t('proInfoAction')} aria-label={t('proInfoAction')} onClick={onOffer}><Sparkles aria-hidden="true" /></button>
    </div></div>
  </div>;
}
