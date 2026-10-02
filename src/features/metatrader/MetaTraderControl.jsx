import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link2, RefreshCw, Check, X } from 'lucide-react';
import { parseMetaTraderExport, pendingMetaTrader, rowsForMetaTraderAccount } from './parseMetaTrader.mjs';
import { SyncSummary } from '../platforms/PlatformConnections';
import MetaTraderSetup from './MetaTraderSetup';
import './MetaTraderControl.css';
import CompanionSetup from './CompanionSetup';
import ConnectionInfo from './ConnectionInfo';
import { companionToken, companionRequest, companionFolder } from './companion.mjs';

export default function MetaTraderControl(props) {
  return <MetaTraderLocal {...props} />;
}

function MetaTraderLocal({ trades, saveTrade, userId, enabled, visible, language, isLight, onClose, onConnectionChange }) {
  const [folder, setFolder] = useState(null), [snapshot, setSnapshot] = useState(null);
  const [accountId, setAccountId] = useState(''), [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [auto, setAuto] = useState(false);
  const [selecting, setSelecting] = useState(false), [confirming, setConfirming] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const visibleNow = useRef(visible); visibleNow.current = visible;
  const [sessionOwner, setSessionOwner] = useState(userId);
  const dialog = useRef(null), close = useRef(onClose), lock = useRef(false);
  const imported = useRef(new Set()), generation = useRef(0), live = useRef({});
  const pendingConnect = useRef(false), activeCompanion = useRef(null);
  close.current = onClose; live.current = { trades, saveTrade, userId, enabled, accountId };
  const ru = language === 'ru', ro = language === 'md' || language === 'ro';
  const t = (r, e, m, z) => language === 'zh-CN' ? z : ru ? r : ro ? m : e;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canChooseFolder = !mobile && /Win/i.test(navigator.platform) && typeof window.showDirectoryPicker === 'function';
  const savedCount = Object.values(trades).flat().filter(row => row.platform === 'MT5').length;
  const accounts = snapshot?.accounts || [], selected = accounts.find(account => account.id === accountId);
  const selectedRows = rowsForMetaTraderAccount(snapshot?.rows || [], accountId);
  useEffect(() => {
    if (!visible || !enabled || confirming || selecting) { setCountdown(null); return; }
    if (countdown === null) return;
    if (countdown === 10) dialog.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    if (countdown === 0) { setCountdown(null); close.current(); return; }
    const timer = setTimeout(() => setCountdown(value => value === null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, visible, enabled, confirming, selecting]);
  useEffect(() => () => {
    if (activeCompanion.current) companionRequest('disconnect', activeCompanion.current).catch(() => {});
  }, []);
  const accountTrades = rowsForMetaTraderAccount(Object.values(trades).flat().filter(row => row.platform === 'MT5'), accountId).length;
  useEffect(() => {
    const current = sessionOwner === userId;
    onConnectionChange?.({ owner: userId, connected: current && enabled && connected, auto: current && enabled && auto && Boolean(folder), busy: current && busy, accountId: current ? accountId : '', lastSync: current ? lastSync : null });
  }, [onConnectionChange, userId, sessionOwner, enabled, connected, auto, folder, busy, accountId, lastSync]);
  useEffect(() => {
    if (activeCompanion.current) companionRequest('disconnect', activeCompanion.current).catch(() => {});
    activeCompanion.current = null; pendingConnect.current = false;
    generation.current++; setSessionOwner(userId); setFolder(null); setSnapshot(null); setAccountId(''); setConnected(false); setAuto(false);
    setCountdown(null); setStatus(''); setSelecting(false); setConfirming(false); setLastSync(null); imported.current.clear();
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
    if (!files) throw new Error(t('Экспорт MT5 не найден. Подключите DAYRIS_MT5 к графику.', 'MT5 export not found. Attach DAYRIS_MT5 to a chart.', 'Exportul MT5 lipsește. Atașează DAYRIS_MT5 la un grafic.', "未找到 MT5 导出文件，请将 DAYRIS_MT5 添加到图表。"));
    return { rows, accounts: [...accounts.values()] };
  }
  function preview(data, handle) {
    if (data.accounts.some(account => account.platform !== 'MT5')) throw new Error('Select a MetaTrader 5 export');
    if (!data.accounts.length) throw new Error(t('Файл найден, но в нём нет счёта. Обновите DAYRIS_MT5: скачайте экспортёр ниже, замените файл в Experts и добавьте его на график заново. Затем выберите папку снова. Сделку для подключения открывать не нужно.', 'File found, but it has no account. Update DAYRIS_MT5: download the exporter below, replace it in Experts and reattach it to a chart. Select the folder again. No trade is needed to connect.', 'Fișier găsit, dar fără cont. Actualizează DAYRIS_MT5, înlocuiește fișierul din Experts și atașează-l din nou la grafic. Alege din nou folderul. Nu este necesară o tranzacție.', "已找到文件，但没有账户信息。请下载下方新版 DAYRIS_MT5 导出器，替换 Experts 中的文件并重新添加到图表，再选择文件夹。无需开仓即可连接。"));
    setCountdown(null); generation.current++; setFolder(handle); setSnapshot(data); setAuto(false); setConnected(false); setStatus(''); setLastSync(null);
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
  async function connectCompanion() {
    if (lock.current || busy) return;
    const session = generation.current;
    setBusy(true); setStatus(t('Подтвердите подключение в окне помощника DAYRIS.', 'Approve the connection in the DAYRIS companion.', 'Aprobă conexiunea în asistentul DAYRIS.', "请在 DAYRIS 助手中批准连接。"));
    const token = companionToken();
    try {
      const result = await companionRequest('connect', token);
      if (session !== generation.current || !live.current.enabled) { companionRequest('disconnect', token).catch(() => {}); return; }
      const handle = companionFolder(token);
      activeCompanion.current = token; pendingConnect.current = true;
      const data = parseMetaTraderExport(result.csv);
      preview(data, handle);
    } catch (error) { if (session === generation.current) setStatus(error.message); }
    finally { setBusy(false); }
  }
  async function sync(data, id, session, announce = false) {
    if (lock.current || !live.current.enabled || !live.current.userId || session !== generation.current) return;
    if (!data.accounts.some(account => account.id === id)) throw new Error(t('Выбранный счёт не найден. Подключите его снова.', 'Selected account is missing. Reconnect it.', 'Contul selectat lipsește. Reconectează-l.', "所选账户不存在，请重新连接。"));
    lock.current = true; setBusy(true);
    const owner = live.current.userId;
    try {
      const checked = rowsForMetaTraderAccount(data.rows, id);
      const pending = pendingMetaTrader(checked, live.current.trades).filter(row => !imported.current.has(row.comment));
      let count = 0;
      for (const row of pending) {
        if (live.current.userId !== owner || session !== generation.current || !live.current.enabled || live.current.accountId !== id) return;
        await live.current.saveTrade(row);
        if (session !== generation.current) return;
        imported.current.add(row.comment); count++;
        setStatus(t(`Сохранено ${count} из ${pending.length}`, `Saved ${count} of ${pending.length}`, `Salvate ${count} din ${pending.length}`, `已保存 ${count} / ${pending.length}`));
      }
      if (session !== generation.current) return;
      setSnapshot(data); setConnected(true);
      setLastSync({ at: Date.now(), added: count, accountId: id, checked: checked.length,
        instruments: [...new Set(pending.map(row => row.instrument))].join(', '),
        dates: [...new Set(pending.map(row => row.dateKey))].sort().join(', ') });
      setStatus(t(`Добавлено: ${count} · Проверено в ${new Date().toLocaleTimeString()}`, `Added: ${count} · Checked at ${new Date().toLocaleTimeString()}`, `Adăugate: ${count} · Verificat la ${new Date().toLocaleTimeString()}`, `新增：${count} · 检查时间：${new Date().toLocaleTimeString()}`));
      if (announce && visibleNow.current) setCountdown(10);
    } catch (error) { if (session === generation.current) { setAuto(false); setStatus(error.message); } }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh(announce = false) {
    if (announce) setCountdown(null);
    const session = generation.current, id = live.current.accountId;
    try { const data = folder ? await readFolder(folder) : snapshot; if (session === generation.current && data) await sync(data, id, session, announce); }
    catch (error) { if (session === generation.current) { setAuto(false); setStatus(error.message); } }
  }
  useEffect(() => {
    if (pendingConnect.current && folder?.companion && accountId && snapshot && !busy) {
      pendingConnect.current = false;
      setAuto(true);
      sync(snapshot, accountId, generation.current, true);
    }
  }, [folder, accountId, snapshot, busy]);
  useEffect(() => {
    if (!auto || !folder || !enabled || !userId || !connected || !accountId) return;
    const timer = setInterval(() => { if (!lock.current) refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [auto, folder, userId, enabled, connected, accountId]);
  function disconnect() {
    if (folder?.companion) companionRequest('disconnect', folder.token).catch(() => {});
    activeCompanion.current = null; pendingConnect.current = false; setCountdown(null);
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
  function accountLabel(account) { return <><span className="block break-words text-sm font-medium">{account.broker || account.server}</span><span className="mt-1 block break-all font-mono text-xs text-zinc-500">{account.account} · {account.mode || t('Тип неизвестен', 'Unknown type', 'Tip necunoscut', "未知类型")}</span><span className="mt-1 block break-all text-[11px] text-zinc-500">{account.server}</span></>; }
  function balance(account) { return <div className="max-w-[45%] min-w-0 text-right"><p className="text-[10px] text-zinc-500">{t('Баланс', 'Balance', 'Sold', "余额")}</p><p className="mt-1 break-words text-sm tabular-nums">{account.balance == null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(account.balance)} ${account.currency}`}</p></div>; }
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mt5-title" className={`relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border p-5 shadow-xl outline-none sm:p-6 ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-500/20" aria-label={t('Закрыть', 'Close', 'Închide', "关闭")}><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3 pr-12"><Link2 className="h-5 w-5 shrink-0 text-amber-500" /><div><p className="text-[10px] tracking-widest text-amber-500">DAYRIS · MT5</p><h2 id="mt5-title" className="mt-1 text-lg font-semibold">MetaTrader 5</h2><p className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-500'}`} />{connected ? (folder ? t('Подключён на этом компьютере', 'Connected on this computer', 'Conectat pe acest calculator', "已在此电脑上连接") : t('Файл импортирован · без автообновления', 'File imported · no auto-refresh', 'Fișier importat · fără actualizare automată', "文件已导入，不会自动刷新")) : t('Подключение через компьютер', 'Connect through your computer', 'Conectare prin calculator', "通过电脑连接")}</p></div></div>
      {!snapshot && savedCount > 0 && <p className="mt-4 text-xs leading-5 text-zinc-500">{t(`В вашем календаре уже есть сделки MT5: ${savedCount}. Это сохранённая история, а не подтверждение активного подключения на этом устройстве.`, `Your calendar already contains ${savedCount} MT5 trades. Saved history does not mean this device has an active connection.`, `Calendarul conține deja ${savedCount} tranzacții MT5. Istoricul salvat nu confirmă o conexiune activă pe acest dispozitiv.`, `日历中已有 ${savedCount} 笔 MT5 交易。已保存历史不代表此设备当前已连接。`)}</p>}
      <p role="status" className={status ? 'mt-4 rounded-xl border border-zinc-500/25 p-3 text-xs leading-5 break-words' : ''}>{status}</p>
      {countdown !== null && lastSync && <div role="status" className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5">
        <p className="font-semibold">{t(`В календарь добавлено сделок: ${lastSync.added}`, `Trades added to calendar: ${lastSync.added}`, `Tranzacții adăugate în calendar: ${lastSync.added}`, `已添加到日历的交易：${lastSync.added}`)}</p>
        <p>{lastSync.added ? `${lastSync.instruments} · ${lastSync.dates}` : t('Новых закрытых позиций нет. Сохранённые сделки не дублируются.', 'No new closed positions. Saved trades are not duplicated.', 'Nu există poziții închise noi. Tranzacțiile salvate nu sunt duplicate.', "没有新的平仓头寸，已保存交易不会重复导入。")}</p>
        <p>{t(`Проверено закрытых позиций: ${lastSync.checked}. Окно закроется через ${countdown} сек.`, `Closed positions checked: ${lastSync.checked}. Closing in ${countdown} sec.`, `Poziții închise verificate: ${lastSync.checked}. Închidere în ${countdown} sec.`, `已检查 ${lastSync.checked} 个平仓头寸，将在 ${countdown} 秒后关闭。`)}</p>
        <button className="mt-1 underline" onClick={() => setCountdown(null)}>{t('Оставить окно открытым', 'Keep this dialog open', 'Păstrează dialogul deschis', "保持此窗口打开")}</button>
      </div>}
      <ConnectionInfo t={t} mobile={mobile} />
      {confirming ? <div className="mt-5"><h3 className="font-semibold">{t('Отключить MT5?', 'Disconnect MT5?', 'Deconectezi MT5?', "断开 MT5 连接？")}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{t('Обновление остановится. Сохранённые сделки останутся в журнале.', 'Refresh stops. Saved trades remain in your journal.', 'Actualizarea se oprește. Tranzacțiile salvate rămân în jurnal.', "更新将停止，已保存交易仍保留在日志中。")}</p><div className="mt-4 flex gap-2"><button disabled={busy} className={secondary} onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel', 'Anulează', "取消")}</button><button disabled={busy} className={secondary} onClick={disconnect}>{t('Отключить', 'Disconnect', 'Deconectează', "断开连接")}</button></div></div> : <>
        {selected && <div className={`mt-5 ${card}`}><h3 className="mb-4 text-xs font-semibold">{t(connected ? 'Выбранный счёт' : 'Проверьте счёт перед импортом', connected ? 'Selected account' : 'Review account before importing', connected ? 'Cont selectat' : 'Verifică contul înainte de import', connected ? "所选账户" : "导入前核对账户")}</h3><div className="flex items-center justify-between gap-3"><div className="min-w-0">{accountLabel(selected)}</div>{balance(selected)}</div>{selected.updated && <p className="mt-3 text-[10px] text-zinc-500">{t('Снимок терминала', 'Terminal snapshot', 'Instantaneu terminal', "终端快照")}: {selected.updated} · {folder?.companion ? 'UTC' : t('время брокера', 'broker time', 'ora brokerului', "经纪商时间")}</p>}</div>}
        {snapshot && (selecting || !selected) && <div className="mt-4" role="group" aria-label={t('Выберите счёт', 'Choose account', 'Alege contul', "选择账户")}><p className="mb-2 text-xs text-zinc-500">{t('Выберите счёт', 'Choose account', 'Alege contul', "选择账户")}</p><div className="max-h-60 space-y-2 overflow-y-auto">{accounts.map(account => <button key={account.id} disabled={busy} aria-pressed={accountId === account.id} onClick={() => { generation.current++; setAccountId(account.id); setAuto(false); setConnected(false); setStatus(''); setSelecting(false); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-40 ${accountId === account.id ? 'border-amber-400/60 bg-amber-400/10' : isLight ? 'border-zinc-200' : 'border-zinc-800'}`}><span className="min-w-0 flex-1">{accountLabel(account)}</span>{balance(account)}{accountId === account.id && <Check className="h-4 w-4 shrink-0 text-amber-500" />}</button>)}</div>{!accounts.length && <p className="text-xs leading-5 text-zinc-500">{t('Старый пустой экспорт не содержит счёт. Установите обновлённый экспортёр ниже и выберите папку снова.', 'Old empty export has no account. Install the updated exporter below and select the folder again.', 'Exportul vechi gol nu conține contul. Actualizează exportatorul și alege din nou folderul.', "旧版空导出文件不含账户信息。请安装下方新版导出器，然后重新选择文件夹。")}</p>}</div>}
        {selected && <><p className="mt-4 text-xs text-zinc-500">{t('Закрытых позиций', 'Closed positions', 'Poziții închise', "已平仓头寸")}: {selectedRows.length} · {t('Новых', 'New', 'Noi', "新增")}: {pendingMetaTrader(selectedRows, trades).filter(row => !imported.current.has(row.comment)).length}</p><button disabled={busy} onClick={() => refresh(true)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{t(busy ? 'Синхронизация…' : connected ? 'Синхронизировать' : 'Подключить и синхронизировать', busy ? 'Syncing…' : connected ? 'Synchronize' : 'Connect and synchronize', busy ? 'Sincronizare…' : connected ? 'Sincronizează' : 'Conectează și sincronizează', busy ? "正在同步…" : connected ? "同步" : "连接并同步")}</button><p className="mt-2 text-[11px] leading-5 text-zinc-500">{t('Только выбранный счёт → ваш текущий журнал DAYRIS. Повторы пропускаются.', 'Selected account only → your current DAYRIS journal. Duplicates are skipped.', 'Doar contul selectat → jurnalul DAYRIS curent. Duplicatele sunt omise.', "仅导入所选账户到当前 DAYRIS 日志，跳过重复记录。")}</p></>}
        {snapshot && <div className="mt-3 flex flex-wrap gap-2"><button hidden={accounts.length < 2} disabled={busy} className={secondary} onClick={() => setSelecting(value => !value)}>{t('Выбрать счёт', 'Choose account', 'Alege contul', "选择账户")}</button><button disabled={busy} className={secondary} onClick={() => setConfirming(true)}>{t('Отключить', 'Disconnect', 'Deconectează', "断开连接")}</button></div>}
        {folder && connected && <label className="mt-4 flex items-center gap-3 text-xs"><input type="checkbox" checked={auto} disabled={busy} onChange={event => setAuto(event.target.checked)} className="h-4 w-4 accent-amber-400" />{t('Автосинхронизация каждые 30 секунд', 'Auto-sync every 30 seconds', 'Sincronizare automată la 30 secunde', "每 30 秒自动同步")}</label>}
        <CompanionSetup t={t} mobile={mobile} busy={busy} snapshot={snapshot} connect={connectCompanion} />
        <details className="mt-4 text-xs"><summary className="cursor-pointer text-zinc-500">{t('Дополнительные способы импорта', 'Other import methods', 'Alte metode de import', "其他导入方式")}</summary><MetaTraderSetup t={t} canChooseFolder={canChooseFolder} mobile={mobile} busy={busy} snapshot={snapshot} chooseFolder={chooseFolder} onFile={chooseFile} isLight={isLight} /></details>
      </>}
      {selected && !confirming && <SyncSummary language={language} platform="MT5" count={accountTrades} lastSync={lastSync?.accountId === accountId ? lastSync : null} />}
      <p className="mt-4 border-t border-zinc-500/20 pt-3 text-[11px] leading-5 text-zinc-500">{t('Только полностью закрытые позиции. Повторы пропускаются. Время сделок — по часам брокера. Сохранённые сделки доступны на телефоне через ваш аккаунт DAYRIS.', 'Fully closed positions only. Duplicates are skipped. Trade times use the broker clock. Saved trades are available on your phone through your DAYRIS account.', 'Doar poziții complet închise. Duplicatele sunt omise. Orele tranzacțiilor sunt cele ale brokerului. Tranzacțiile salvate sunt disponibile pe telefon prin contul DAYRIS.', "仅导入完全平仓的头寸，跳过重复交易。交易时间采用经纪商时间，已保存的交易可通过 DAYRIS 账户在手机上查看。")}</p>
    </section>
  </div>, document.body);
}
