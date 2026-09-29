import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { parseMetaTrader, pendingMetaTrader } from './parseMetaTrader.mjs';

export default function MetaTraderControl({ trades, saveTrade, userId, enabled, visible, language, isLight, onClose }) {
  const [folder, setFolder] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [preview, setPreview] = useState(null);
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  const live = useRef({ trades, saveTrade, userId, enabled });
  live.current = { trades, saveTrade, userId, enabled };
  const lock = useRef(false), imported = useRef(new Set()), generation = useRef(0);
  const ru = language === 'ru', ro = language === 'md' || language === 'ro';
  const t = (r, e, m) => ru ? r : ro ? m : e;
  useEffect(() => {
    generation.current++;
    setFolder(null); setAuto(false); setPreview(null); setStatus(''); imported.current.clear();
  }, [userId, enabled]);
  useEffect(() => {
    if (!visible || !enabled) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const controls = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, [visible, enabled]);
  async function readFolder(handle) {
    const rows = []; let files = 0;
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind !== 'file' || !/^dayris-mt5-.+\.csv$/i.test(name)) continue;
      const file = await entry.getFile();
      if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large');
      rows.push(...parseMetaTrader(await file.text())); files++;
    }
    if (!files) throw new Error(t('В папке нет экспорта MT5. Прикрепите DAYRIS_MT5 к графику и выберите папку DAYRIS.', 'No MT5 export. Attach DAYRIS_MT5 to a chart and choose the DAYRIS folder.', 'Nu există export MT5. Atașează DAYRIS_MT5 la un grafic și alege folderul DAYRIS.'));
    return rows;
  }
  async function chooseFolder() {
    const session = generation.current;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read', id: 'dayris-metatrader' });
      const rows = await readFolder(handle);
      if (session !== generation.current || !live.current.enabled) return;
      setAuto(false); setFolder(handle); setPreview(rows); setStatus('');
    } catch (error) { if (error.name !== 'AbortError') setStatus(error.message); }
  }
  async function sync(rows) {
    if (lock.current || !live.current.enabled || !live.current.userId) return;
    lock.current = true; setBusy(true);
    const owner = live.current.userId, session = generation.current;
    let count = 0;
    try {
      const pending = pendingMetaTrader(rows, live.current.trades).filter(row => !imported.current.has(row.comment));
      for (const row of pending) {
        if (live.current.userId !== owner || session !== generation.current || !live.current.enabled) break;
        await live.current.saveTrade(row);
        if (session !== generation.current) return;
        imported.current.add(row.comment); count++;
        setStatus(t(`Сохранение ${count} из ${pending.length}…`, `Saving ${count} of ${pending.length}…`, `Salvare ${count} din ${pending.length}…`));
      }
      if (session !== generation.current) return;
      setStatus(t(`Добавлено ${count} сделок · ${new Date().toLocaleTimeString()}`, `Added ${count} trades · ${new Date().toLocaleTimeString()}`, `Adăugate ${count} tranzacții · ${new Date().toLocaleTimeString()}`));
      setPreview(null);
    } catch (error) { setAuto(false); setStatus(error.message); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!auto || !folder || !enabled || !userId) return;
    const session = generation.current;
    const timer = setInterval(async () => {
      if (lock.current) return;
      try { const rows = await readFolder(folder); if (session === generation.current) await sync(rows); }
      catch (error) { if (session === generation.current) { setStatus(error.message); setAuto(false); } }
    }, 30000);
    return () => clearInterval(timer);
  }, [auto, folder, userId, enabled]);
  if (!visible || !enabled || !userId) return null;
  const secondary = `min-h-11 rounded-xl border px-4 py-3 text-xs font-semibold ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-700 bg-white/[0.025]'}`;
  const folderSupported = typeof window.showDirectoryPicker === 'function';
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mt5-title" className={`relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border p-5 shadow-xl outline-none sm:p-6 ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 h-11 w-11 rounded-xl border border-zinc-500/20" aria-label={t('Закрыть', 'Close', 'Închide')}>×</button>
      <p className="text-[10px] tracking-widest text-amber-500">DAYRIS PRO</p>
      <h2 id="mt5-title" className="mt-1 pr-12 text-xl font-semibold">MetaTrader 5</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{t('Подключите свой терминал. Закрытые позиции появятся в вашем журнале DAYRIS с учётом комиссий и свопа.', 'Connect your terminal. Closed positions appear in your DAYRIS journal including commissions and swap.', 'Conectează terminalul tău. Pozițiile închise apar în jurnalul DAYRIS cu comisioane și swap.')}</p>
      <ol className="mt-5 space-y-4">
        <li><h3 className="text-sm font-semibold">1. {t('Установите экспортёр', 'Install the exporter', 'Instalează exportatorul')}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{t('В MT5: Файл → Открыть каталог данных → MQL5 → Experts. Скопируйте туда скачанный файл .ex5.', 'MT5: File → Open Data Folder → MQL5 → Experts. Copy the downloaded .ex5 file there.', 'MT5: Fișier → Deschide folderul de date → MQL5 → Experts. Copiază fișierul .ex5 acolo.')}</p>
          <div className="mt-2 flex flex-wrap gap-2"><a className={secondary} href="/metatrader/DAYRIS_MT5.ex5" download>{t('Скачать экспортёр MT5', 'Download MT5 exporter', 'Descarcă exportatorul MT5')}</a><a className="p-3 text-xs text-zinc-500" href="/metatrader/DAYRIS_MT5.mq5" download>{t('Исходный код', 'Source code', 'Cod sursă')}</a></div>
        </li>
        <li><h3 className="text-sm font-semibold">2. {t('Подключите к одному графику', 'Attach to one chart', 'Atașează la un grafic')}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{t('Обновите «Советники» в Навигаторе MT5 и перетащите DAYRIS_MT5 на график. Он читает историю; торговые разрешения, DLL, пароль и API-ключ не нужны.', 'Refresh Expert Advisors in the MT5 Navigator and drag DAYRIS_MT5 onto one chart. It reads history only; trading permissions, DLLs, passwords and API keys are not required.', 'Actualizează Expert Advisors și trage DAYRIS_MT5 pe un grafic. Citește doar istoricul; nu necesită permisiuni de tranzacționare, DLL, parolă sau cheie API.')}</p>
        </li>
        <li><h3 className="text-sm font-semibold">3. {t('Выберите папку и подтвердите импорт', 'Choose a folder and confirm import', 'Alege folderul și confirmă importul')}</h3>
          <p className="mt-1 break-words font-mono text-[10px] leading-5 text-zinc-500">%APPDATA%\MetaQuotes\Terminal\Common\Files\DAYRIS</p>
          {folderSupported ? <button type="button" disabled={busy} onClick={chooseFolder} className={`mt-2 ${secondary}`}>{t('Выбрать папку DAYRIS', 'Choose DAYRIS folder', 'Alege folderul DAYRIS')}</button> : <p className="mt-2 text-xs leading-5 text-zinc-500">{t('Автообновление папки доступно в Chrome/Edge на компьютере. Здесь можно импортировать файл вручную.', 'Folder auto-sync is available in desktop Chrome/Edge. You can import a file manually here.', 'Actualizarea automată este disponibilă în Chrome/Edge pe PC. Aici poți importa manual.')}</p>}
          <label className="mt-3 block text-xs">{t('Импорт файла .csv экспортёра', 'Import exporter .csv file', 'Importă fișierul .csv al exportatorului')}<input type="file" accept=".csv" disabled={busy} className="mt-2 block max-w-full" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
            const session = generation.current;
            try {
              if (file.size > 20 * 1024 * 1024) throw new Error('Export is too large');
              const rows = parseMetaTrader(await file.text());
              if (rows.some(row => row.platform !== 'MT5')) throw new Error(t('Выберите экспорт MetaTrader 5.', 'Select a MetaTrader 5 export.', 'Selectează un export MetaTrader 5.'));
              if (session !== generation.current) return;
              setAuto(false); setFolder(null); setPreview(rows); setStatus('');
            } catch (error) { setStatus(error.message); }
          }} /></label>
        </li>
      </ol>
      {preview && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
        <p className="text-xs">{t('Новых позиций', 'New positions', 'Poziții noi')}: {pendingMetaTrader(preview, trades).length} · {t('Всего', 'Total', 'Total')}: {preview.length}</p>
        {!preview.length && <p className="mt-2 text-xs leading-5 text-zinc-500">{t('Экспортёр подключён, но полностью закрытых позиций пока нет. Подтвердите подключение, чтобы включить автообновление.', 'Exporter detected; no fully closed positions yet. Confirm connection to enable auto-refresh.', 'Exportatorul este conectat; nu există poziții închise complet. Confirmă conectarea pentru actualizare automată.')}</p>}
        <p className="mt-2 text-xs leading-5 text-zinc-500">{t('Сделки сохраняются в вашем текущем аккаунте DAYRIS. Повторные записи пропускаются. Даты — по времени брокера.', 'Trades are saved into your current DAYRIS account. Existing entries are skipped. Dates use broker time.', 'Tranzacțiile sunt salvate în contul DAYRIS curent. Duplicatele sunt omise. Data este ora brokerului.')}</p>
        <button type="button" disabled={busy} onClick={() => sync(preview)} className={`mt-3 ${secondary}`}>{busy ? t('Сохранение…', 'Saving…', 'Salvare…') : preview.length ? t('Импортировать в мой журнал', 'Import into my journal', 'Importă în jurnalul meu') : t('Подтвердить подключение', 'Confirm connection', 'Confirmă conectarea')}</button>
      </div>}
      {folder && <label className="mt-4 flex items-center gap-3 text-xs"><input type="checkbox" checked={auto} disabled={busy || preview !== null} onChange={event => setAuto(event.target.checked)} className="h-4 w-4 accent-amber-400" />{t('Обновлять каждые 30 секунд', 'Refresh every 30 seconds', 'Actualizare la fiecare 30 secunde')}</label>}
      <p role="status" className="mt-3 break-words text-xs leading-5 text-zinc-500">{status}</p>
      <p className="mt-4 border-t border-zinc-500/20 pt-3 text-[11px] leading-5 text-zinc-500">{t('Для автообновления оставьте терминал и сайт открытыми на компьютере. После перезагрузки сайта выберите папку снова. На телефон сделки попадут через облачную синхронизацию DAYRIS. MT4 пока не проверен и не предлагается как готовое подключение.', 'Keep the terminal and site open on desktop for auto-sync. Select the folder again after reload. Trades reach mobile through DAYRIS cloud sync. MT4 is not yet verified or offered as a ready connection.', 'Pentru actualizare automată lasă terminalul și site-ul deschise pe PC. Selectează din nou folderul după reîncărcare. Tranzacțiile ajung pe telefon prin sincronizarea cloud DAYRIS. MT4 nu este încă verificat.')}</p>
      <a className="mt-3 inline-block text-xs text-amber-500" href="/metatrader/setup.txt" target="_blank" rel="noreferrer">{t('Подробная инструкция', 'Full setup instructions', 'Instrucțiuni complete')} →</a>
    </section>
  </div>, document.body);
}
