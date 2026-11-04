import React, { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { dateLabel, money } from './botCalendarModel.js';
import './BotDayEditor.css';

export default function BotDayEditor({ client, slug, day, onClose, onSaved }) {
  const dialog = useRef(null);
  const [snapshot, setSnapshot] = useState(null);
  const [trades, setTrades] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [restore, setRestore] = useState(false);
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    let active = true;
    setSnapshot(null); setError('');
    client.rpc('admin_bot_day', { p_slug: slug, p_day: day }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setError('Не удалось открыть день. Проверь вход через Google и права администратора.');
      else { setSnapshot(data); setNote(data.note); setTrades(data.trades.map(t => ({ ...t, key: crypto.randomUUID() }))); }
    }).catch(() => { if (active) setError('Нет соединения. Попробуй ещё раз.'); });
    return () => { active = false; };
  }, [client, slug, day, reload]);
  const update = (key, field, value) => setTrades(rows => rows.map(row => row.key === key ? { ...row, [field]: value } : row));
  async function save(event, reset = false) {
    event.preventDefault();
    if (busy || !snapshot) return;
    setBusy(true); setError('');
    try {
      const { error } = await client.rpc('admin_bot_day_save', {
        p_slug: slug, p_day: day, p_revision: snapshot.revision, p_note: note,
        p_trades: trades.map(({ time, instrument, direction, pnl, comment }) => ({ time, instrument, direction, pnl: Number(pnl), comment: comment || '' })), p_restore: reset,
      });
      if (error) throw error;
      onSaved();
    } catch (failure) {
      setError(failure?.message?.includes('DAY_CHANGED_RELOAD') ? 'День уже изменён в другом окне. Скопируй свои правки и загрузи день заново.' : 'Не удалось сохранить. Проверь соединение, поля и права доступа. Правки остались здесь.');
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="bot-dialog bot-day-editor" aria-labelledby="bot-editor-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="bot-dialog-inner">
      <header><div><p>РЕДАКТОР ОБЩЕГО КАЛЕНДАРЯ</p><h2 id="bot-editor-title">{dateLabel(day)}</h2></div><button type="button" disabled={busy} aria-label="Закрыть редактор" onClick={onClose}><X /></button></header>
      <p className="bot-editor-hint">Сохранённые записи и текст увидят все. Результат дня, месяца и аналитика пересчитываются автоматически.</p>
      {error && <div role="alert" className="bot-editor-error">{error}<button type="button" disabled={busy} onClick={() => setReload(n => n + 1)}>Загрузить день заново</button></div>}
      {!snapshot ? !error && <p role="status">Загружаем день…</p> : <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>Текст дня<textarea maxLength={3000} rows={3} value={note} placeholder="Комментарий, объявление или свои заметки для читателей" onChange={e => setNote(e.target.value)} /></label>
          <div className="bot-editor-total"><span>{trades.length} записей</span><strong>{money(trades.reduce((n, t) => n + Number(t.pnl || 0), 0), snapshot.currency, true)}</strong></div>
          <div className="bot-editor-rows">{trades.map((t, i) => <article key={t.key}>
            <header><strong>Запись {i + 1}</strong><button type="button" aria-label={`Удалить запись ${i + 1}`} onClick={() => setTrades(rows => rows.filter(row => row.key !== t.key))}><Trash2 size={17}/></button></header>
            <div className="bot-editor-fields">
              <label>Время<input type="time" step="1" required value={t.time} onChange={e => update(t.key, 'time', e.target.value)} /></label>
              <label>Название<input required maxLength={120} value={t.instrument} onChange={e => update(t.key, 'instrument', e.target.value)} /></label>
              <label>Направление<select value={t.direction} onChange={e => update(t.key, 'direction', e.target.value)}><option value="LONG">Buy</option><option value="SHORT">Sell</option></select></label>
              <label>Результат · {snapshot.currency}<input type="number" step="any" min="-1000000000" max="1000000000" required value={t.pnl} onChange={e => update(t.key, 'pnl', e.target.value)} /></label>
            </div>
            <label>Комментарий<textarea rows={2} maxLength={2000} value={t.comment || ''} onChange={e => update(t.key, 'comment', e.target.value)} /></label>
          </article>)}</div>
          <button className="bot-editor-add" type="button" onClick={() => setTrades(rows => [...rows, { key: crypto.randomUUID(), time: '12:00:00', instrument: 'XAUUSD', direction: 'LONG', pnl: '', comment: '' }])}><Plus size={17}/>Добавить запись</button>
          <div className="bot-editor-footer"><button type="button" onClick={onClose}>Отмена</button><button className="bot-editor-save" type="submit">{busy ? 'Сохраняем…' : 'Сохранить для всех'}</button></div>
          {snapshot.edited && <div className="bot-editor-restore">{restore ? <><p>Убрать все ручные правки этого дня и показать исходные данные?</p><button type="button" onClick={e => save(e, true)}>Да, вернуть исходные</button><button type="button" onClick={() => setRestore(false)}>Оставить правки</button></> : <button type="button" onClick={() => setRestore(true)}><RotateCcw size={15}/>Вернуть исходный день</button>}</div>}
        </fieldset>
      </form>}
    </div>
  </dialog>;
}
