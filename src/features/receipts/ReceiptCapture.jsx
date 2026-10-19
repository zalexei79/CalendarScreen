import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Plus, Trash2, X } from 'lucide-react';
import { CURRENCIES, MONEY_CATEGORIES } from '../../shared/config/constants';
import { localDateKey } from '../../shared/lib/voiceEntryReview.js';
import { checkReceiptAccess } from './receiptAccess.js';
import { recognizeReceipt } from './receiptOcr.js';
import { parseReceipt, receiptLineTotal, receiptMoney, moneyText, receiptValidation, validReceiptDate } from './receiptModel.js';
import { receiptCopy } from './receiptCopy.js';
import './ReceiptCapture.css';

export default function ReceiptCapture({ userId, proActive, proLoading, language = 'ru', isLight, onUpgrade, onSaveReceipt, checkAccess = checkReceiptAccess, recognize = recognizeReceipt }) {
  const c = receiptCopy(language), today = localDateKey();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(null), [preview, setPreview] = useState('');
  const [phase, setPhase] = useState('idle'), [progress, setProgress] = useState(0), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false), [saved, setSaved] = useState(null);
  const gallery = useRef(null), camera = useRef(null), dialog = useRef(null), trigger = useRef(null), generation = useRef(0), abort = useRef(null), busySave = useRef(false), mounted = useRef(false), currentOwner = useRef(userId);
  currentOwner.current = userId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; abort.current?.abort(); }; }, []);
  useEffect(() => { generation.current++; abort.current?.abort(); setOpen(false); setDraft(null); setPreview(''); setSaved(null); setError(''); setPhase('idle'); setConfirmed(false); }, [userId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current?.open) { dialog.current.close(); trigger.current?.focus(); }
  }, [open]);
  const busy = phase === 'reading' || phase === 'checking' || phase === 'saving';
  function close() { if (busySave.current) return; generation.current++; abort.current?.abort(); setOpen(false); setDraft(null); setPreview(''); setSaved(null); setError(''); setPhase('idle'); }
  function choose() {
    if (proLoading) return;
    if (!userId || !proActive) { onUpgrade?.(); return; }
    gallery.current?.click();
  }
  function update(next) { setDraft(previous => ({ ...previous, ...next })); setConfirmed(false); setError(''); }
  function updateItem(index, key, value) {
    const items = draft.items.map((item, row) => {
      if (row !== index) return item;
      const next = { ...item, [key]: value };
      if (key === 'quantity' || key === 'unitPrice') next.total = receiptLineTotal(next.quantity, next.unitPrice);
      return next;
    });
    update({ items });
  }
  async function selectFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busySave.current) return;
    const request = ++generation.current, owner = userId;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const alive = () => mounted.current && request === generation.current && currentOwner.current === owner;
    setOpen(true); setDraft(null); setSaved(null); setPreview(''); setConfirmed(false); setError(''); setProgress(0);
    if (!/^image\/(?:jpeg|png|webp|bmp)$/i.test(file.type) || file.size > 20 * 1024 * 1024) { setPhase('review'); setError(c.file); return; }
    setPreview(URL.createObjectURL(file)); setPhase('checking');
    try {
      if (!await checkAccess(owner)) { if (alive()) { close(); onUpgrade?.(); } return; }
      if (!alive()) return;
      setPhase('reading');
      const text = await recognize(file, { language, signal: controller.signal, onProgress: value => { if (alive()) setProgress(value); } });
      if (alive()) { setDraft(parseReceipt(text)); setPhase('review'); }
    } catch (failure) {
      if (!alive()) return;
      setError(failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? c.access : c.error);
      // Access failure must not expose a manually writable receipt form.
      if (failure.message !== 'RECEIPT_ACCESS_UNAVAILABLE') setDraft(parseReceipt(''));
      setPhase('review');
    }
  }
  const validation = draft ? receiptValidation(draft, today, CURRENCIES.map(item => item.code)) : null;
  async function save() {
    if (busySave.current || !confirmed || !validation?.valid) return;
    const owner = userId, request = generation.current;
    busySave.current = true; setPhase('saving'); setError('');
    const snapshot = structuredClone(draft);
    try {
      if (!await checkAccess(owner)) throw new Error('RECEIPT_ACCESS_UNAVAILABLE');
      if (currentOwner.current !== owner || request !== generation.current || !mounted.current) return;
      const result = await onSaveReceipt(snapshot, owner);
      if (currentOwner.current === owner && request === generation.current && mounted.current) { setSaved({ ...snapshot, ...result }); setPhase('saved'); }
    } catch (failure) {
      if (currentOwner.current === owner && request === generation.current && mounted.current) { setError(failure.message === 'RECEIPT_DUPLICATE' ? c.duplicate : failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? c.access : c.saveError); setPhase('review'); }
    } finally { busySave.current = false; }
  }
  const field = (label, key, props = {}) => <label className="receipt-field"><span>{label}</span><input {...props} value={draft[key]} disabled={busy} onChange={event => update({ [key]: event.target.value })}/></label>;
  const categoryLabel = item => String(language).startsWith('zh') ? item['zh-CN'] : language === 'en' ? item.en : ['ro','md'].includes(language) ? item.ro : item.key;
  return <>
    <button ref={trigger} type="button" className="receipt-launch" data-light={isLight} aria-label={`${c.photo} · PRO`} title={`${c.photo} · PRO`} disabled={proLoading} onClick={choose}><Camera size={20}/></button>
    <input ref={gallery} className="receipt-file" type="file" accept="image/*" aria-label={c.gallery} onChange={selectFile}/>
    <input ref={camera} className="receipt-file" type="file" accept="image/*" capture="environment" aria-label={c.camera} onChange={selectFile}/>
    {createPortal(<dialog ref={dialog} className="receipt-dialog" data-light={isLight} aria-labelledby="receipt-title" onCancel={event => { event.preventDefault(); close(); }}>
      {open && <div className="receipt-shell">
        <header className="receipt-heading"><div><small>DAYRIS <b>PRO</b></small><h2 id="receipt-title">{c.title}</h2></div><button type="button" aria-label={c.close} disabled={phase === 'saving'} onClick={close}><X size={20}/></button></header>
        <div className="receipt-scroll">
          {saved ? <div className="receipt-success" role="status"><Check size={32}/><h3>{c.saved}</h3><strong>{moneyText(receiptMoney(saved.total))} {saved.currency}</strong><p>{saved.dateKey}</p>{saved.dayTotal !== undefined && <p>{c.dayTotal}: <b>{saved.dayTotal} {saved.currency}</b></p>}</div> : <>
            {preview && <details className="receipt-preview" open={!draft}><summary>{c.photo}</summary><a href={preview} target="_blank" rel="noreferrer"><img src={preview} alt={c.photo}/></a></details>}
            {(phase === 'reading' || phase === 'checking') && <div className="receipt-progress" role="status"><strong>{c.reading} {phase === 'reading' ? `${progress}%` : ''}</strong><progress max="100" value={progress}/><p>{c.loading}</p></div>}
            {error && <p className="receipt-warning" role="alert">{error}</p>}
            {draft && <fieldset disabled={busy} className="receipt-fields"><legend>{c.review}</legend>
              {field(c.merchant,'merchant',{maxLength:120})}
              <div className="receipt-pair">{field(c.date,'dateKey',{type:'date',max:today})}<label className="receipt-field"><span>{c.currency}</span><select aria-label={c.currency} value={draft.currency} onChange={event => update({currency:event.target.value})}><option value="">{c.choose}</option>{!CURRENCIES.some(item => item.code === draft.currency) && draft.currency && <option value={draft.currency} disabled>{draft.currency}</option>}{CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label></div>
              {!validReceiptDate(draft.dateKey,today) && <p className="receipt-warning">{c.dateMissing}</p>}
              <label className="receipt-field"><span>{c.category}</span><select aria-label={c.category} value={draft.category} onChange={event => update({category:event.target.value})}>{MONEY_CATEGORIES.filter(item => item.type !== 'plus').map(item => <option key={item.key} value={item.key}>{categoryLabel(item)}</option>)}</select></label>
              <div className="receipt-section-title"><h3>{c.items} <small>{draft.items.length}</small></h3><button type="button" onClick={() => update({items:[...draft.items,{name:'',quantity:'1',unitPrice:'',total:''}]})}><Plus size={16}/>{c.add}</button></div>
              {!draft.items.length && <p className="receipt-muted">{c.totalOnly}</p>}
              {draft.items.map((item,index) => <div className="receipt-item" key={index}>
                <div className="receipt-item-name"><label className="receipt-field"><span>{c.name} {index+1}</span><input value={item.name} maxLength={180} onChange={event => updateItem(index,'name',event.target.value)}/></label><button type="button" aria-label={`${c.remove} ${index+1}`} onClick={() => update({items:draft.items.filter((_,row) => row !== index)})}><Trash2 size={17}/></button></div>
                <div className="receipt-item-numbers">{[['quantity',c.quantity],['unitPrice',c.price],['total',c.lineTotal]].map(([key,label]) => <label className="receipt-field" key={key}><span>{label}</span><input aria-label={`${label} ${index+1}`} inputMode="decimal" value={item[key]} onChange={event => updateItem(index,key,event.target.value)}/></label>)}</div>
              </div>)}
              {draft.items.length > 0 && <p className="receipt-sum">{c.itemSum}<b>{moneyText(validation.sum)} {draft.currency}</b></p>}
              {(validation.mismatch || validation.lineMismatch) && <p className="receipt-warning">{c.mismatch}</p>}
              <div className="receipt-total">{field(c.total,'total',{inputMode:'decimal'})}<b>{draft.currency || '—'}</b></div>
              {!draft.evidence && <p className="receipt-warning">{c.missing}</p>}
              {draft.evidence && <blockquote className="receipt-evidence">{draft.evidence}</blockquote>}
              <details className="receipt-raw"><summary>{c.raw}</summary><textarea aria-label={c.raw} value={draft.rawText} maxLength={40000} onChange={event => update({rawText:event.target.value})}/><button type="button" onClick={() => { setDraft(parseReceipt(draft.rawText)); setConfirmed(false); }}>{c.reparse}</button></details>
              <label className="receipt-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>{c.confirm}</span></label>
            </fieldset>}
            {!busy && <div className="receipt-choose"><button type="button" onClick={() => camera.current?.click()}><Camera size={16}/>{c.camera}</button><button type="button" onClick={() => gallery.current?.click()}>{c.gallery}</button></div>}
          </>}
        </div>
        <footer className="receipt-footer"><button type="button" className="receipt-primary" disabled={!saved && (busy || !confirmed || !validation?.valid)} onClick={saved ? close : save}>{saved ? c.done : phase === 'saving' ? c.saving : c.save}</button></footer>
      </div>}
    </dialog>,document.body)}
  </>;
}
