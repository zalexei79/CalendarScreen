import React, { useState } from 'react';
import { Check, Link2, RefreshCw } from 'lucide-react';

export default function CtraderControl({ t, isLight, connected, reconnect, loading, syncing, accounts, accountId, onConnect, onSelect, onSync, onDisconnect }) {
  const [selecting, setSelecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busy = loading || syncing;
  const selected = accounts.find(a => a.id === accountId);
  const secondary = `rounded-xl border px-4 py-3 text-sm disabled:opacity-40 ${isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-zinc-800 hover:bg-white/5'}`;
  return <section className="min-w-0" aria-label="cTrader">
    <div className="flex items-center gap-3 pr-7">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/30'}`}><Link2 className="h-5 w-5 text-amber-500" /></div>
      <div className="min-w-0"><h2 className="text-lg font-semibold">cTrader</h2><p className="mt-1 flex items-center gap-2 text-xs opacity-70"><span className={`h-1.5 w-1.5 rounded-full ${connected && !reconnect ? 'bg-emerald-500' : 'bg-zinc-400'}`} />{t(reconnect ? 'ctSessionExpired' : connected ? 'connected' : 'ctConnectSubtitle')}</p></div>
    </div>
    {confirming ? <div className="mt-6" role="group" aria-label={t('ctDisconnectTitle')}>
      <h3 className="font-semibold">{t('ctDisconnectTitle')}</h3>
      <p className="mt-2 text-sm leading-relaxed opacity-70">{t('ctDisconnectBody')}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button disabled={busy} className={secondary} onClick={() => setConfirming(false)}>{t('cancel')}</button>
        <button disabled={busy} className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 disabled:opacity-40" onClick={async () => { if (await onDisconnect()) setConfirming(false); }}>{t('ctDisconnect')}</button>
      </div>
    </div> : <>
      {selected && <div className={`mt-5 rounded-2xl border px-4 py-3 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-black/20'}`}>
        <p className="break-words text-sm font-medium">{selected.broker_name || 'cTrader'}</p>
        <p className="mt-1 break-all font-mono text-xs opacity-60">{selected.account_id} · {selected.is_live ? 'Live' : 'Demo'}</p>
      </div>}
      {connected && !reconnect && (selecting || !selected) && <div className="mt-4" role="group" aria-label={t('ctChoose')}>
        <p className="mb-2 text-xs opacity-60">{t('ctChoose')}</p>
        <div className="max-h-56 space-y-2 overflow-y-auto">
          {accounts.map(a => <button key={a.id} disabled={busy} aria-pressed={accountId === a.id} onClick={async () => { if (await onSelect(a.id)) setSelecting(false); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-50 ${accountId === a.id ? 'border-amber-400/60 bg-amber-400/10' : isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-zinc-800 hover:bg-white/5'}`}>
            <span className="min-w-0 flex-1"><span className="block break-words text-sm">{a.broker_name || 'cTrader'}</span><span className="mt-1 block break-all font-mono text-xs opacity-60">{a.account_id} · {a.is_live ? 'Live' : 'Demo'}</span></span>{accountId === a.id && <Check className="h-4 w-4 shrink-0 text-amber-500" />}
          </button>)}
          {!accounts.length && <p className="text-sm opacity-60">{t('ctEmpty')}</p>}
        </div>
      </div>}
      <button disabled={busy || (connected && !reconnect && !selected)} onClick={connected && !reconnect ? onSync : onConnect} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-40">
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : connected && !reconnect ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {t(syncing ? 'syncing' : loading ? 'connecting' : reconnect ? 'ctReconnect' : connected ? 'synchronize' : 'connectCtraderBtn')}
      </button>
      {(connected || reconnect) && <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!reconnect && <button disabled={busy} onClick={() => setSelecting(v => !v)} className={secondary}>{t('ctSwitch')}</button>}
        <button disabled={busy} onClick={() => setConfirming(true)} className="min-h-11 px-3 text-sm text-zinc-500 hover:text-red-500 disabled:opacity-40">{t('ctDisconnect')}</button>
      </div>}
      {connected && !reconnect && selecting && <button disabled={busy} onClick={onConnect} className="mt-3 min-h-11 text-xs opacity-60">{t('ctGrantAccounts')}</button>}
    </>}
  </section>;
}
