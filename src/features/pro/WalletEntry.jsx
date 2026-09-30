import React from 'react';
import { ArrowUpRight, LockKeyhole, Wallet } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';

export default function WalletEntry({ language, access, loading, onOpen, onOffer }) {
  const t = (r,e,m) => platformText(language,r,e,m);
  const label = t('Кошелёк','Wallet','Portofel');
  return <button type="button" className="wallet-entry" data-access={Boolean(access)} disabled={loading} onClick={() => { if (loading) return; if (access) onOpen(); else onOffer(); }} aria-label={`${label} · ${t(access ? 'открыть' : 'доступ с PRO', access ? 'open' : 'PRO access', access ? 'deschide' : 'acces PRO')}`}>
    <span className="wallet-entry-icon"><Wallet aria-hidden="true"/></span>
    <span className="wallet-entry-copy"><span className="wallet-entry-heading">{label}<span className="wallet-entry-badge">PRO</span></span><span className="wallet-entry-caption">{loading ? t('Проверяем доступ…','Checking access…','Verificăm accesul…') : t('Личные деньги. Отдельно от сделок.','Personal money. Separate from trades.','Banii personali. Separat de trading.')}</span></span>
    <span className="wallet-entry-action" aria-hidden="true">{access ? <ArrowUpRight/> : <LockKeyhole/>}</span>
  </button>;
}
