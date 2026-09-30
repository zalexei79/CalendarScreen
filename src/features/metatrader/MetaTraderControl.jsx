import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, RefreshCw, Check, X } from 'lucide-react';
import { parseMetaTraderExport, pendingMetaTrader, rowsForMetaTraderAccount } from './parseMetaTrader.mjs';
import { SyncSummary } from '../platforms/PlatformConnections';
import MetaTraderSetup from './MetaTraderSetup';
import './MetaTraderControl.css';

export default function MetaTraderControl({ trades, saveTrade, userId, enabled, visible, language, isLight, onClose, onConnectionChange }) {
  const [folder, setFolder] = useState(null), [snapshot, setSnapshot] = useState(null);
  const [accountId, setAccountId] = useState(''), [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [auto, setAuto] = useState(false);
  const [selecting, setSelecting] = useState(false), [confirming, setConfirming] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [sessionOwner, setSessionOwner] = useState(userId);
  const dialog = useRef(null), close = useRef(onClose), lock = useRef(false);
  const imported = useRef(new Set()), generation = useRef(0), live = useRef({});
  close.current = onClose; live.current = { trades, saveTrade, userId, enabled, accountId };
  const ru = language === 'ru', ro = language === 'md' || language === 'ro';
  const t = (r, e, m) => ru ? r : ro ? m : e;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canChooseFolder = !mobile && /Win/i.test(navigator.platform) && typeof window.showDirectoryPicker === 'function';
  const savedCount = Object.values(trades).flat().filter(row => row.platform === 'MT5').length;
  const accounts = snapshot?.accounts || [], selected = accounts.find(account => account.id === accountId);
  const selectedRows = rowsForMetaTraderAccount(snapshot?.rows || [], accountId);
  const accountTrades = rowsForMetaTraderAccount(Object.values(trades).flat().filter(row => row.platform === 'MT5'), accountId).length;
  useEffect(() => {
    const current = sessionOwner === userId;
    onConnectionChange?.({ owner: userId, connected: current && enabled && connected, auto: current && enabled && auto && Boolean(folder), busy: current && busy, accountId: current ? accountId : '', lastSync: current ? lastSync : null });
  }, [onConnectionChange, userId, sessionOwner, enabled, connected, auto, folder, busy, accountId, lastSync]);
  useEffect(() => {
    generation.current++; setSessionOwner(userId); setFolder(null); setSnapshot(null); setAccountId(''); setConnected(false); setAuto(false);
    setStatus(''); setSelecting(false); setConfirming(false); setLastSync(null); imported.current.clear();
  }, [userId, enabled]);
  useEffect(() => {
    if (!visible || !enabled) return;
    const previous = document.activeElement; dialog.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), summary')].filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, [visible, enabled]);
  async function readFolder(handle) {
    const rows = [], accounts = new Map(); let files = 0;
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind !== 'file' || !/^dayris-mt5-.+\.csv$/i.test(name)) continue;
      const file = await entry.getFile();
      if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large');
      const data = parseMetaTraderExport(await file.text());
      rows.push(...data.rows); data.accounts.forEach(account => accounts.set(account.id, account)); files++;
    }
    if (!files) throw new Error(t('Экспорт MT5 не найден. Подключите DAYRIS_MT5 к графику.', 'MT5 export not found. Attach DAYRIS_MT5 to a chart.', 'Exportul MT5 lipsește. Atașează DAYRIS_MT5 la un grafic.'));
    return { rows, accounts: [...accounts.values()] };
  }
  function preview(data, handle) {
    if (data.accounts.some(account => account.platform !== 'MT5')) throw new Error('Select a MetaTrader 5 export');
    if (!data.accounts.length) throw new Error(t('Файл найден, но в нём нет счёта. Обновите DAYRIS_MT5: скачайте экспортёр ниже, замените файл в Experts и добавьте его на график заново. Затем выберите папку снова. Сделку для подключения открывать не нужно.', 'File found, but it has no account. Update DAYRIS_MT5: download the exporter below, replace it in Experts and reattach it to a chart. Select the folder again. No trade is needed to connect.', 'Fișier găsit, dar fără cont. Actualizează DAYRIS_MT5, înlocuiește fișierul din Experts și atașează-l din nou la grafic. Alege din nou folderul. Nu este necesară o tranzacție.'));
    generation.current++; setFolder(handle); setSnapshot(data); setAuto(false); setConnected(false); setStatus(''); setLastSync(null);
    setAccountId(data.accounts[0]?.id || ''); setSelecting(data.accounts.length > 1);
  }
  async function chooseFolder() {
    const session = generation.current;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read', id: 'dayris-metatrader' });
      const data = await readFolder(handle);
      if (session === generation.current && live.current.enabled) preview(data, handle);
    } catch (error) { if (session === generation.current && error.name !== 'AbortError') setStatus(error.message); }
  }
  async function sync(data, id, session) {
    if (lock.current || !live.current.enabled || !live.current.userId || session !== generation.current) return;
    if (!data.accounts.some(account => account.id === id)) throw new Error(t('Выбранный счёт не найден. Подключите его снова.', 'Selected account is missing. Reconnect it.', 'Contul selectat lipsește. Reconectează-l.'));
    lock.current = true; setBusy(true);
    const owner = live.current.userId;
    try {
      const pending = pendingMetaTrader(rowsForMetaTraderAccount(data.rows, id), live.current.trades).filter(row => !imported.current.has(row.comment));
      let count = 0;
      for (const row of pending) {
        if (live.current.userId !== owner || session !== generation.current || !live.current.enabled || live.current.accountId !== id) return;
        await live.current.saveTrade(row);
        if (session !== generation.current) return;
        imported.current.add(row.comment); count++;
        setStatus(t(`Сохранено ${count} из ${pending.length}`, `Saved ${count} of ${pending.length}`, `Salvate ${count} din ${pending.length}`));
      }
      if (session !== generation.current) return;
      setSnapshot(data); setConnected(true);
      setLastSync({ at: Date.now(), added: count, accountId: id });
      setStatus(t(`Добавлено: ${count} · Проверено в ${new Date().toLocaleTimeString()}`, `Added: ${count} · Checked at ${new Date().toLocaleTimeString()}`, `Adăugate: ${count} · Verificat la ${new Date().toLocaleTimeString()}`));
    } catch (error) { if (session === generation.current) { setAuto(false); setStatus(error.message); } }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() {
    const session = generation.current, id = live.current.accountId;
    try { const data = folder ? await readFolder(folder) : snapshot; if (session === generation.current && data) await sync(data, id, session); }
    catch (error) { if (session === generation.current) { setAuto(false); setStatus(error.message); } }
  }
  useEffect(() => {
    if (!auto || !folder || !enabled || !userId || !connected || !accountId) return;
    const timer = setInterval(() => { if (!lock.current) refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [auto, folder, userId, enabled, connected, accountId]);
  function disconnect() {
    generation.current++; setAuto(false); setFolder(null); setSnapshot(null); setAccountId('');
    setConnected(false); setStatus(''); setConfirming(false); setSelecting(false); setLastSync(null);
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const session = generation.current;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large');
      const data = parseMetaTraderExport(await file.text());
      if (session === generation.current && live.current.enabled) preview(data, null);
    } catch (error) { if (session === generation.current) setStatus(error.message); }
  }
  if (!visible || !enabled || !userId) return null;
  const secondary = `min-h-11 rounded-xl border px-4 py-3 text-xs font-semibold disabled:opacity-40 ${isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-zinc-800 hover:bg-white/5'}`;
  const card = `rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-black/20'}`;
  function accountLabel(account) { return <><span className="block break-words text-sm font-medium">{account.broker || account.server}</span><span className="mt-1 block break-all font-mono text-xs text-zinc-500">{account.account} · {account.mode || t('Тип неизвестен', 'Unknown type', 'Tip necunoscut')}</span><span className="mt-1 block break-all text-[11px] text-zinc-500">{account.server}</span></>; }
  function balance(account) { return <div className="max-w-[45%] min-w-0 text-right"><p className="text-[10px] text-zinc-500">{t('Баланс', 'Balance', 'Sold')}</p><p className="mt-1 break-words text-sm tabular-nums">{account.balance == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(account.balance)} ${account.currency}`}</p></div>; }
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mt5-title" className={`relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border p-5 shadow-xl outline-none sm:p-6 ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/20" aria-label={t('Закрыть', 'Close', 'Închide')}><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3 pr-12"><Link2 className="h-5 w-5 shrink-0 text-amber-500" /><div><p className="text-[10px] tracking-widest text-amber-500">DAYRIS PRO</p><h2 id="mt5-title" className="mt-1 text-lg font-semibold">MetaTrader 5</h2><p className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-500'}`} />{connected ? (folder ? t('Подключён через папку на этом ПК', 'Connected through this PC’s folder', 'Conectat prin folderul acestui PC') : t('Файл импортирован · без автообновления', 'File imported · no auto-refresh', 'Fișier importat · fără actualizare automată')) : t('Подключение через компьютер', 'Connect through your computer', 'Conectare prin calculator')}</p></div></div>
      {!snapshot && savedCount > 0 && <p className="mt-4 text-xs leading-5 text-zinc-500">{t(`В вашем календаре уже есть сделки MT5: ${savedCount}. Это сохранённая история, а не подтверждение активного подключения на этом устройстве.`, `Your calendar already contains ${savedCount} MT5 trades. Saved history does not mean this device has an active connection.`, `Calendarul conține deja ${savedCount} tranzacții MT5. Istoricul salvat nu confirmă o conexiune activă pe acest dispozitiv.`)}</p>}
      <p role="status" className={status ? 'mt-4 rounded-xl border border-zinc-500/25 p-3 text-xs leading-5 break-words' : ''}>{status}</p>
      {confirming ? <div className="mt-5"><h3 className="font-semibold">{t('Отключить MT5?', 'Disconnect MT5?', 'Deconectezi MT5?')}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{t('Обновление остановится. Сохранённые сделки останутся в журнале.', 'Refresh stops. Saved trades remain in your journal.', 'Actualizarea se oprește. Tranzacțiile salvate rămân în jurnal.')}</p><div className="mt-4 flex gap-2"><button disabled={busy} className={secondary} onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel', 'Anulează')}</button><button disabled={busy} className={secondary} onClick={disconnect}>{t('Отключить', 'Disconnect', 'Deconectează')}</button></div></div> : <>
        {selected && <div className={`mt-5 ${card}`}><h3 className="mb-4 text-xs font-semibold">{t(connected ? 'Выбранный счёт' : 'Проверьте счёт перед импортом', connected ? 'Selected account' : 'Review account before importing', connected ? 'Cont selectat' : 'Verifică contul înainte de import')}</h3><div className="flex items-center justify-between gap-3"><div className="min-w-0">{accountLabel(selected)}</div>{balance(selected)}</div>{selected.updated && <p className="mt-3 text-[10px] text-zinc-500">{t('Снимок терминала', 'Terminal snapshot', 'Instantaneu terminal')}: {selected.updated} · {t('время брокера', 'broker time', 'ora brokerului')}</p>}</div>}
        {snapshot && (selecting || !selected) && <div className="mt-4" role="group" aria-label={t('Выберите счёт', 'Choose account', 'Alege contul')}><p className="mb-2 text-xs text-zinc-500">{t('Выберите счёт', 'Choose account', 'Alege contul')}</p><div className="max-h-60 space-y-2 overflow-y-auto">{accounts.map(account => <button key={account.id} disabled={busy} aria-pressed={accountId === account.id} onClick={() => { generation.current++; setAccountId(account.id); setAuto(false); setConnected(false); setStatus(''); setSelecting(false); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-40 ${accountId === account.id ? 'border-amber-400/60 bg-amber-400/10' : isLight ? 'border-zinc-200' : 'border-zinc-800'}`}><span className="min-w-0 flex-1">{accountLabel(account)}</span>{balance(account)}{accountId === account.id && <Check className="h-4 w-4 shrink-0 text-amber-500" />}</button>)}</div>{!accounts.length && <p className="text-xs leading-5 text-zinc-500">{t('Старый пустой экспорт не содержит счёт. Установите обновлённый экспортёр ниже и выберите папку снова.', 'Old empty export has no account. Install the updated exporter below and select the folder again.', 'Exportul vechi gol nu conține contul. Actualizează exportatorul și alege din nou folderul.')}</p>}</div>}
        {selected && <><p className="mt-4 text-xs text-zinc-500">{t('Закрытых позиций', 'Closed positions', 'Poziții închise')}: {selectedRows.length} · {t('Новых', 'New', 'Noi')}: {pendingMetaTrader(selectedRows, trades).filter(row => !imported.current.has(row.comment)).length}</p><button disabled={busy} onClick={refresh} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{t(busy ? 'Синхронизация…' : connected ? 'Синхронизировать' : 'Подключить и синхронизировать', busy ? 'Syncing…' : connected ? 'Synchronize' : 'Connect and synchronize', busy ? 'Sincronizare…' : connected ? 'Sincronizează' : 'Conectează și sincronizează')}</button><p className="mt-2 text-[11px] leading-5 text-zinc-500">{t('Только выбранный счёт → ваш текущий журнал DAYRIS. Повторы пропускаются.', 'Selected account only → your current DAYRIS journal. Duplicates are skipped.', 'Doar contul selectat → jurnalul DAYRIS curent. Duplicatele sunt omise.')}</p></>}
        {snapshot && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className={secondary} onClick={() => setSelecting(value => !value)}>{t('Выбрать счёт', 'Choose account', 'Alege contul')}</button><button disabled={busy} className={secondary} onClick={() => setConfirming(true)}>{t('Отключить', 'Disconnect', 'Deconectează')}</button></div>}
        {folder && connected && <label className="mt-4 flex items-center gap-3 text-xs"><input type="checkbox" checked={auto} disabled={busy} onChange={event => setAuto(event.target.checked)} className="h-4 w-4 accent-amber-400" />{t('Автосинхронизация каждые 30 секунд', 'Auto-sync every 30 seconds', 'Sincronizare automată la 30 secunde')}</label>}
        <MetaTraderSetup t={t} canChooseFolder={canChooseFolder} mobile={mobile} busy={busy} snapshot={snapshot} chooseFolder={chooseFolder} onFile={chooseFile} isLight={isLight} />
      </>}
      {selected && !confirming && <SyncSummary language={language} platform="MT5" count={accountTrades} lastSync={lastSync?.accountId === accountId ? lastSync : null} />}
      <p className="mt-4 border-t border-zinc-500/20 pt-3 text-[11px] leading-5 text-zinc-500">{t('Автосинхронизация: Chrome/Edge на ПК, терминал и сайт открыты. После перезагрузки выберите папку снова. Баланс — снимок на указанное время. Сделки передаются на телефон через существующую облачную синхронизацию DAYRIS. MT4 пока не проверен.', 'Auto-sync: desktop Chrome/Edge with terminal and site open. Select the folder again after reload. Balance is a timestamped snapshot. Trades reach mobile through existing DAYRIS cloud sync. MT4 is not verified yet.', 'Sincronizare automată: Chrome/Edge pe PC, terminal și site deschise. Alege din nou folderul după reîncărcare. Soldul este un instantaneu. Tranzacțiile ajung pe telefon prin cloud DAYRIS. MT4 nu este încă verificat.')}</p>
      <a className="mt-3 inline-block text-xs text-amber-500" href="/metatrader/setup.txt" target="_blank" rel="noreferrer">{t('Инструкция', 'Instructions', 'Instrucțiuni')} →</a>
    </section>
  </div>, document.body);
}
