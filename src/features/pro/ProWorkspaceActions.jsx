import React, { useId } from 'react';
import { Link2, Monitor, Sparkles, Wallet } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';
import './ProPresentation.css';
import './WorkspaceModePanel.css';

export default function ProWorkspaceActions({ visible, inPanel = false, isLight, language, t, traderMode, onTraderChange, onWallet, onConnect, connected, metatrader = {}, reconnect, onOffer }) {
  const text = (r,e,m) => platformText(language,r,e,m);
  const platformsId = useId();
  // Do not retain a hidden, zero-width flexbox: it can wrap into a tall column.
  if (!visible) return null;
  return <div className={`pro-actions-reveal is-visible ${inPanel ? 'in-workspace-panel' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Управление PRO','PRO workspace controls','Comenzi PRO')}>
    <div className="pro-actions" aria-label="DAYRIS PRO">
      {!inPanel && <button type="button" className="pro-control pro-control-wallet" onClick={onWallet} title={t('walletProHint')} aria-label={t('walletLabel')}><Wallet aria-hidden="true"/><span>{t('walletLabel')}</span></button>}
      <button type="button" role="switch" aria-checked={traderMode} aria-expanded={traderMode} aria-controls={platformsId} aria-label={t('traderModeLabel')} title={t('traderModeHint')} onClick={onTraderChange} className="pro-control pro-control-trader"><span>{text('Трейдер','Trader','Trader')}</span><span className="pro-control-toggle" aria-hidden="true"><span/></span></button>
      {!inPanel && <button type="button" className="pro-control pro-control-info" title={t('proInfoAction')} aria-label={t('proInfoAction')} onClick={onOffer}><Sparkles aria-hidden="true"/></button>}
      <div id={platformsId} className={`pro-platform-reveal ${traderMode ? 'is-open' : ''}`} aria-hidden={!traderMode} inert={traderMode ? undefined : ''}>
        <div className="pro-platform-clip"><div className="pro-platform-row">
        { [['ctrader','cTrader',Link2,connected && !reconnect],['mt5','MT5',Monitor,metatrader.connected]].map(([id,name,Icon,ready])=>{
          const status = id === 'mt5' ? ready ? text('Подключён на ПК','Connected on PC','Conectat pe PC') : text('Нет связи на этом устройстве','No connection on this device','Fără conexiune pe acest dispozitiv') : id==='ctrader' && reconnect ? text('Нужен вход','Reconnect required','Reconectare necesară') : ready ? text('Подключён','Connected','Conectat') : text('Не подключён','Not connected','Neconectat');
          return <button key={id} type="button" disabled={!traderMode} className="pro-control pro-control-connect pro-control-platform" title={`${name} · ${status}`} aria-label={`${name} · ${status} · ${text('открыть меню','open menu','deschide meniul')}`} onClick={()=>onConnect(id)}><Icon aria-hidden="true"/><span className="pro-platform-label"><strong>{name}</strong><small>{status}</small></span><i data-connected={Boolean(ready && traderMode)} aria-hidden="true"/></button>;
        })}
        </div></div>
      </div>
    </div>
  </div>;
}
