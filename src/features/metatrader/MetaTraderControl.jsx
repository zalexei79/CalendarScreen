import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseMetaTrader, pendingMetaTrader } from './parseMetaTrader.mjs';

export default function MetaTraderControl({ trades, saveTrade, userId, visible, language, isLight, onClose }) {
  const [folder, setFolder] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [preview, setPreview] = useState(null);
  const live = useRef({ trades, saveTrade, userId });
  live.current = { trades, saveTrade, userId };
  const lock = useRef(false);
  const imported = useRef(new Set());
  const ru = language === 'ru', ro = language === 'md' || language === 'ro';
  const t = (r, e, m) => ru ? r : ro ? m : e;
  useEffect(() => { setFolder(null); setAuto(false); setPreview(null); imported.current.clear(); }, [userId]);
  async function readFolder(handle) {
    const rows = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file' && /^dayris-mt[45]-.+\.csv$/i.test(name)) {
        const file = await entry.getFile();
        if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large');
        rows.push(...parseMetaTrader(await file.text()));
      }
    }
    return rows;
  }
  async function load() {
    try {
      if (!window.showDirectoryPicker) throw new Error(t('Автосинхронизация папки доступна в Chrome/Edge на компьютере. Используйте импорт файла.', 'Folder sync requires desktop Chrome/Edge. Use file import.', 'Sincronizarea folderului necesită Chrome/Edge pe PC. Importă un fișier.'));
      const handle = await window.showDirectoryPicker({ mode: 'read', id: 'dayris-metatrader' });
      const rows = await readFolder(handle);
      if (!rows.length) throw new Error(t('Закрытых сделок пока нет. Проверьте экспортёр и выбранную папку.', 'No closed trades found. Check the exporter and folder.', 'Nu există tranzacții închise. Verifică exportatorul și folderul.'));
      setFolder(handle); setPreview(rows); setStatus('');
    } catch (error) { if (error.name !== 'AbortError') setStatus(error.message); }
  }
  async function sync(rows) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const owner = live.current.userId;
    let count = 0;
    try {
      for (const row of pendingMetaTrader(rows, live.current.trades)) {
        if (live.current.userId !== owner) throw new Error('Account changed. Sync stopped.');
        if (imported.current.has(row.comment)) continue;
        await live.current.saveTrade(row);
        imported.current.add(row.comment); count++;
      }
      setStatus(t(`Добавлено ${count} сделок · ${new Date().toLocaleTimeString()}`, `Added ${count} trades · ${new Date().toLocaleTimeString()}`, `Adăugate ${count} tranzacții · ${new Date().toLocaleTimeString()}`));
      setPreview(null);
    } catch (error) { setAuto(false); setStatus(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!auto || !folder) return;
    const timer = setInterval(async () => {
      if (lock.current) return;
      try { await sync(await readFolder(folder)); } catch (error) { setStatus(error.message); setAuto(false); }
    }, 30000);
    return () => clearInterval(timer);
  }, [auto, folder, userId]);
  if (!visible) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={event => { if(event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="MetaTrader 4 / 5" className={`relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border p-5 shadow-xl ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
    <button type="button" onClick={onClose} className="absolute right-3 top-3 h-9 w-9 rounded-lg border border-zinc-500/20" aria-label={t('Закрыть','Close','Închide')}>×</button>
    <h2 className="text-lg font-semibold">MetaTrader 4 / 5</h2>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{t('Закрытые сделки из терминала → DAYRIS. Установите экспортёр и выберите папку Terminal\\Common\\Files\\DAYRIS. Обновление каждые 30 секунд, пока сайт и терминал открыты на компьютере.', 'Closed trades from terminal → DAYRIS. Install the exporter and select Terminal\\Common\\Files\\DAYRIS. Refreshes every 30 seconds while site and terminal are open on desktop.', 'Tranzacții închise → DAYRIS. Instalează exportatorul și selectează Terminal\\Common\\Files\\DAYRIS. Actualizare la 30 secunde cât timp site-ul și terminalul sunt deschise.')}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs"><a className="min-h-10 rounded-lg border border-zinc-500/20 p-3" href="/metatrader/DAYRIS_MT5.mq5" download>MT5 · {t('Экспортёр', 'Exporter', 'Exportator')}</a><a className="min-h-10 rounded-lg border border-zinc-500/20 p-3" href="/metatrader/DAYRIS_MT4.mq4" download>MT4 · {t('Экспортёр', 'Exporter', 'Exportator')}</a><a className="p-3 text-amber-500" href="/metatrader/setup.txt" target="_blank" rel="noreferrer">{t('Инструкция', 'Setup', 'Instrucțiuni')}</a></div>
    <button type="button" disabled={busy} onClick={load} className="mt-3 min-h-11 rounded-xl border border-amber-400/30 px-4 text-sm">{t('Выбрать папку синхронизации', 'Choose sync folder', 'Alege folderul')}</button>
    <label className="mt-3 block text-xs">{t('Или импортировать файл экспортёра', 'Or import an exporter file', 'Sau importă fișierul exportatorului')}<input type="file" accept=".csv" disabled={busy} className="mt-2 block max-w-full" onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      try { if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large'); setPreview(parseMetaTrader(await file.text())); setStatus(''); }
      catch (error) { setStatus(error.message); }
    }} /></label>
    {preview && <div className="mt-4 rounded-xl border border-zinc-500/20 p-3"><p className="text-xs">{t('Новых записей', 'New entries', 'Înregistrări noi')}: {pendingMetaTrader(preview, trades).length} · {t('Всего в файле', 'In export', 'În fișier')}: {preview.length}</p><p className="mt-2 text-xs text-zinc-500">{t('Импорт в текущий аккаунт DAYRIS. Суммы включают прибыль, комиссию и своп. Дата — время брокера.', 'Import into current DAYRIS account. PnL includes profit, commission and swap. Dates use broker time.', 'Import în contul DAYRIS curent. PnL include profit, comision și swap. Data este ora brokerului.')}</p><button type="button" disabled={busy} onClick={() => sync(preview)} className="mt-3 min-h-11 rounded-xl bg-amber-400/10 px-4 text-sm text-amber-500">{busy ? '…' : t('Импортировать сделки', 'Import trades', 'Importă tranzacțiile')}</button></div>}
    {folder && <label className="mt-4 flex items-center gap-2 text-xs"><input type="checkbox" checked={auto} disabled={busy || !!preview} onChange={event => setAuto(event.target.checked)} />{t('Автообновление выбранной папки', 'Auto-refresh selected folder', 'Actualizare automată a folderului')}</label>}
    <p role="status" className="mt-3 break-words text-xs leading-5 text-zinc-500">{status}</p>
  </section></div>, document.body);
}
