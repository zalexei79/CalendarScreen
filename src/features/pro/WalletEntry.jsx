import React from 'react';
import { ArrowUpRight, LockKeyhole, Wallet } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';

export default function WalletEntry({ language, access, loading, onOpen, onOffer }) {
  const t = (r,e,m,z) => platformText(language,r,e,m,z);
  const label = t('Кошелёк','Wallet','Portofel', "钱包");
  return <button type="button" className="wallet-entry" data-access={Boolean(access)} disabled={loading} onClick={() => { if (loading) return; if (access) onOpen(); else onOffer(); }} aria-label={`${label} · ${t(access ? 'открыть' : 'доступ с PRO', access ? 'open' : 'PRO access', access ? 'deschide' : 'acces PRO', access ? "打开" : "PRO 权限")}`}>
    <span className="wallet-entry-icon"><Wallet aria-hidden="true"/></span>
    <span className="wallet-entry-copy"><span className="wallet-entry-heading">{label}<span className="wallet-entry-badge">PRO</span></span><span className="wallet-entry-caption">{loading ? t('Проверяем доступ…','Checking access…','Verificăm accesul…', "正在检查权限…") : t('Личные деньги. Отдельно от сделок.','Personal money. Separate from trades.','Banii personali. Separat de trading.', "个人财务，与交易分开。")}</span></span>
    <span className="wallet-entry-action" aria-hidden="true">{access ? <ArrowUpRight/> : <LockKeyhole/>}</span>
  </button>;
}
