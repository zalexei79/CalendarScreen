import React, { useId } from 'react';
import { Link2, Monitor, Sparkles, Wallet } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';
import LotCalculator from '../trading/LotCalculator';
import './ProPresentation.css';
import './WorkspaceModePanel.css';

export default function ProWorkspaceActions({ visible, inPanel = false, isLight, language, currency, t, traderMode, onTraderChange, onWallet, onConnect, connected, metatrader = {}, reconnect, onOffer }) {
  const text = (r,e,m,z) => platformText(language,r,e,m,z);
  const platformsId = useId();
  // Do not retain a hidden, zero-width flexbox: it can wrap into a tall column.
  if (!visible) return null;
  return <div className={`pro-actions-reveal is-visible ${inPanel ? 'in-workspace-panel' : ''} ${isLight ? 'pro-light' : ''}`} aria-label={text('Управление PRO','PRO workspace controls','Comenzi PRO', "PRO 工作区控制")}>
    <div className="pro-actions" aria-label="DAYRIS PRO">
      {!inPanel && <button type="button" className="pro-control pro-control-wallet" onClick={onWallet} title={t('walletProHint')} aria-label={t('walletLabel')}><Wallet aria-hidden="true"/><span>{t('walletLabel')}</span></button>}
      <button type="button" role="switch" aria-checked={traderMode} aria-expanded={traderMode} aria-controls={platformsId} aria-label={t('traderModeLabel')} title={t('traderModeHint')} onClick={onTraderChange} className="pro-control pro-control-trader"><span>{text('Трейдер','Trader','Trader', "交易模式")}</span><span className="pro-control-toggle" aria-hidden="true"><span/></span></button>
      {!inPanel && <button type="button" className="pro-control pro-control-info" title={t('proInfoAction')} aria-label={t('proInfoAction')} onClick={onOffer}><Sparkles aria-hidden="true"/></button>}
      <div id={platformsId} className={`pro-platform-reveal ${traderMode ? 'is-open' : ''}`} aria-hidden={!traderMode} inert={traderMode ? undefined : ''}>
        <div className="pro-platform-clip"><div className="pro-platform-row">
        { [['ctrader','cTrader',Link2,connected && !reconnect],['mt5','MT5',Monitor,metatrader.connected]].map(([id,name,Icon,ready])=>{
          const status = id === 'mt5' ? ready ? text('Подключён на ПК','Connected on PC','Conectat pe PC', "已在电脑上连接") : text('Нет связи на этом устройстве','No connection on this device','Fără conexiune pe acest dispozitiv', "此设备未连接") : id==='ctrader' && reconnect ? text('Нужен вход','Reconnect required','Reconectare necesară', "需要重新连接") : ready ? text('Подключён','Connected','Conectat', "已连接") : text('Не подключён','Not connected','Neconectat', "未连接");
          return <button key={id} type="button" disabled={!traderMode} className="pro-control pro-control-connect pro-control-platform" title={`${name} · ${status}`} aria-label={`${name} · ${status} · ${text('открыть меню','open menu','deschide meniul', "打开菜单")}`} onClick={()=>onConnect(id)}><Icon aria-hidden="true"/><span className="pro-platform-label"><strong>{name}</strong><small>{status}</small></span><i data-connected={Boolean(ready && traderMode)} aria-hidden="true"/></button>;
        })}
        <LotCalculator enabled={traderMode} language={language} isLight={isLight} currency={currency}/>
        </div></div>
      </div>
    </div>
  </div>;
}
