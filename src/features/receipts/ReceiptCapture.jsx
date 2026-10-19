import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, Check, ChevronDown, ChevronRight, Pencil, Plus, ReceiptText, ShoppingBag, Trash2, X } from 'lucide-react';
import { CURRENCIES, MONEY_CATEGORIES } from '../../shared/config/constants';
import { localDateKey } from '../../shared/lib/voiceEntryReview.js';
import { checkReceiptAccess } from './receiptAccess.js';
import { recognizeReceipt } from './receiptOcr.js';
import { parseReceipt, receiptLineTotal, receiptMoney, moneyText, receiptValidation, receiptItemIssue, receiptItemMathIssue, validReceiptDate, validReceiptName, receiptProduct, receiptCategory } from './receiptModel.js';
import { receiptCopy } from './receiptCopy.js';
import {readProductMemory,rememberProductType,recalledProductType} from './productMemory.js';
import {productTypeById,productLocale} from './productCatalog.js';
import ProductTypePicker from './ProductTypePicker.jsx';
import './ReceiptCapture.css';

export default function ReceiptCapture({ userId, proActive, proLoading, language = 'ru', isLight, onUpgrade, onSaveReceipt, checkAccess = checkReceiptAccess, recognize = recognizeReceipt }) {
  const c = receiptCopy(language), today = localDateKey();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(null), [preview, setPreview] = useState('');
  const [phase, setPhase] = useState('idle'), [progress, setProgress] = useState(0), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false), [saved, setSaved] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1), [metadataOpen, setMetadataOpen] = useState(false);
  const [omittedItems, setOmittedItems] = useState(null);
  const [productMemory,setProductMemory]=useState(()=>readProductMemory(userId));
  const gallery = useRef(null), camera = useRef(null), dialog = useRef(null), trigger = useRef(null), generation = useRef(0), abort = useRef(null), busySave = useRef(false), mounted = useRef(false), currentOwner = useRef(userId);
  currentOwner.current = userId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; abort.current?.abort(); }; }, []);
  useEffect(() => { generation.current++; abort.current?.abort(); setOpen(false); setDraft(null); setPreview(''); setSaved(null); setError(''); setPhase('idle'); setConfirmed(false); setProductMemory(readProductMemory(userId)); }, [userId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) { dialog.current.showModal(); dialog.current.querySelector('#receipt-title')?.focus({preventScroll:true}); }
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
  function review(text) {
    const parsed = parseReceipt(text);
    const memory=readProductMemory(userId);setProductMemory(memory);
    parsed.items=parsed.items.map(item=>({...item,productType:recalledProductType(memory,item.name)}));
    parsed.category=receiptCategory(parsed.items);
    setDraft(parsed); setOmittedItems(null); setEditingIndex(-1); setConfirmed(false);
    setMetadataOpen(!validReceiptDate(parsed.dateKey,today) || !CURRENCIES.some(item => item.code === parsed.currency));
  }
  function updateItem(index, key, value) {
    const items = draft.items.map((item, row) => {
      if (row !== index) return item;
      const next = { ...item, [key]: value };
      if (key === 'name') next.productType=recalledProductType(productMemory,value);
      if (key === 'quantity' || key === 'unitPrice') { next.total = receiptLineTotal(next.quantity, next.unitPrice); next.priceReviewed = true; }
      return next;
    });
    update({ items });
  }
  function chooseProductType(index,id){
    const type=productTypeById(id),original=draft.items[index].name;
    if(validReceiptName(original))setProductMemory(rememberProductType(userId,original,id));
    const items=draft.items.map((item,row)=>row===index?{...item,productType:type?.id||'',name:validReceiptName(item.name)||!type?item.name:type.labels[productLocale(language)]}:item);
    update({items,...(draft.category===receiptCategory(draft.items)?{category:receiptCategory(items)}:{})});
  }
  function toggleTotalOnly() {
    if (omittedItems) { update({items:omittedItems}); setOmittedItems(null); }
    else { setOmittedItems(draft.items); update({items:[]}); }
    setEditingIndex(-1);
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
      if (alive()) { review(text); setPhase('review'); }
    } catch (failure) {
      if (!alive()) return;
      setError(failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? c.access : c.error);
      // Access failure must not expose a manually writable receipt form.
      if (failure.message !== 'RECEIPT_ACCESS_UNAVAILABLE') review('');
      setPhase('review');
    }
  }
  const validation = draft ? receiptValidation(draft, today, CURRENCIES.map(item => item.code)) : null;
  const itemIssues = draft ? draft.items.flatMap((item,index) => receiptItemIssue(item) ? [index] : []) : [];
  const needsReview = Boolean(itemIssues.length || validation?.mismatch);
  function focusTotal() {
    const input = dialog.current?.querySelector('.receipt-total input');
    input?.focus({preventScroll:true}); input?.scrollIntoView({block:'nearest'});
  }
  function focusCorrection() {
    if (!itemIssues.length) { focusTotal(); return; }
    const index = itemIssues[0];
    setEditingIndex(index);
    requestAnimationFrame(() => {
      const item = dialog.current?.querySelectorAll('.receipt-item')[index];
      const input = validReceiptName(draft.items[index].name) ? item?.querySelectorAll('.receipt-item-numbers input')[1] : item?.querySelector('.receipt-item-name input');
      input?.focus({preventScroll:true}); item?.scrollIntoView({block:'nearest'});
    });
  }
  const actionLabel = saved ? c.done : phase === 'saving' ? c.saving : itemIssues.length ? (itemIssues.length === 1 ? c.checkPurchase : c.checkPurchases) : validation?.mismatch ? c.checkTotal : c.save;
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
  const numberLocale = String(language).startsWith('zh') ? 'zh-CN' : ['md','ro'].includes(language) ? 'ro-MD' : language === 'en' ? 'en-US' : 'ru-RU';
  const displayMoney = value => { const minor = receiptMoney(value); return minor === null ? '—' : new Intl.NumberFormat(numberLocale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100); };
  const dateLabel = draft && validReceiptDate(draft.dateKey,today) ? new Intl.DateTimeFormat(numberLocale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${draft.dateKey}T12:00:00`)) : c.dateMissing;
  const photoChoices = <div className="receipt-choose"><button type="button" onClick={() => camera.current?.click()}><Camera size={16}/>{c.camera}</button><button type="button" onClick={() => gallery.current?.click()}>{c.gallery}</button></div>;
  return <>
    <button ref={trigger} type="button" className="receipt-launch" data-light={isLight} aria-label={`${c.photo} · PRO`} title={`${c.photo} · PRO`} disabled={proLoading} onClick={choose}><Camera size={20}/></button>
    <input ref={gallery} className="receipt-file" type="file" accept="image/*" aria-label={c.gallery} onChange={selectFile}/>
    <input ref={camera} className="receipt-file" type="file" accept="image/*" capture="environment" aria-label={c.camera} onChange={selectFile}/>
    {createPortal(<dialog ref={dialog} className="receipt-dialog" data-light={isLight} aria-labelledby="receipt-title" onCancel={event => { event.preventDefault(); close(); }}>
      {open && <div className="receipt-shell">
        <header className="receipt-heading"><div><small>DAYRIS <b>PRO</b></small><h2 id="receipt-title" tabIndex={-1}>{c.title}</h2></div><button type="button" aria-label={c.close} disabled={phase === 'saving'} onClick={close}><X size={20}/></button></header>
        <div className="receipt-scroll">
          {saved ? <div className="receipt-success" role="status"><Check size={32}/><h3>{c.saved}</h3><strong>{moneyText(receiptMoney(saved.total))} {saved.currency}</strong><p>{saved.dateKey}</p>{saved.dayTotal !== undefined && <p>{c.dayTotal}: <b>{saved.dayTotal} {saved.currency}</b></p>}</div> : <>
            {preview && <details className="receipt-preview" open={!draft}><summary>{c.photo}</summary><a href={preview} target="_blank" rel="noreferrer"><img src={preview} alt={c.photo}/></a>{draft && !busy && photoChoices}</details>}
            {(phase === 'reading' || phase === 'checking') && <div className="receipt-progress" role="status"><strong>{c.reading} {phase === 'reading' ? `${progress}%` : ''}</strong><progress max="100" value={progress}/><p>{c.loading}</p></div>}
            {error && <p className="receipt-warning" role="alert">{error}</p>}
            {draft && <fieldset disabled={busy} className="receipt-fields"><legend className="receipt-sr-only">{c.review}</legend>
              <div className="receipt-overview">
                <div className="receipt-store"><ShoppingBag size={15}/><span>{draft.merchant || c.merchant}</span></div>
                <div className="receipt-total">{field(c.total,'total',{inputMode:'decimal','aria-label':c.total})}<span className="receipt-currency">{draft.currency || '—'}</span><button type="button" className="receipt-edit-total" aria-label={c.editTotal} onClick={focusTotal}><Pencil size={15}/></button></div>
                {!draft.evidence && <p className="receipt-warning">{c.missing}</p>}
                <details className="receipt-metadata" open={metadataOpen}>
                  <summary onClick={event => { event.preventDefault(); setMetadataOpen(!metadataOpen); }}><span>{dateLabel}</span><span>{categoryLabel(MONEY_CATEGORIES.find(item => item.key === draft.category) || MONEY_CATEGORIES.at(-1))}</span><ChevronDown size={15}/></summary>
                  <div className="receipt-meta-fields">{field(c.merchant,'merchant',{maxLength:120})}
                    <div className="receipt-pair">{field(c.date,'dateKey',{type:'date',max:today})}<label className="receipt-field"><span>{c.currency}</span><select aria-label={c.currency} value={draft.currency} onChange={event => update({currency:event.target.value})}><option value="">{c.choose}</option>{!CURRENCIES.some(item => item.code === draft.currency) && draft.currency && <option value={draft.currency} disabled>{draft.currency}</option>}{CURRENCIES.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select></label></div>
                    {!validReceiptDate(draft.dateKey,today) && <p className="receipt-warning">{c.dateMissing}</p>}
                    <label className="receipt-field"><span>{c.category}</span><select aria-label={c.category} value={draft.category} onChange={event => update({category:event.target.value})}>{MONEY_CATEGORIES.filter(item => item.type !== 'plus').map(item => <option key={item.key} value={item.key}>{categoryLabel(item)}</option>)}</select></label>
                  </div>
                </details>
              </div>
              {!omittedItems && <div className="receipt-section-title"><h3>{c.items} <small>{draft.items.length}</small></h3><button type="button" aria-label={c.add} onClick={() => { setEditingIndex(draft.items.length); update({items:[...draft.items,{name:'',quantity:'1',unit:'pcs',unitPrice:'',total:''}]}); }}><Plus size={18}/></button></div>}
              {!draft.items.length && !omittedItems && <p className="receipt-muted">{c.totalOnly}</p>}
              <div className="receipt-items">{draft.items.map((item,index) => {
                const product = receiptProduct(item.name,language,item.productType), expected = receiptLineTotal(item.quantity,item.unitPrice), mismatch = receiptItemMathIssue(item), unknown = !validReceiptName(item.name);
                const unit = c[item.unit] || c.pcs;
                return <details className="receipt-item" data-issue={mismatch || unknown} key={index} open={editingIndex === index}>
                  <summary className="receipt-item-summary" aria-label={`${c.editItem} ${index+1}`} onClick={event => { event.preventDefault(); setEditingIndex(editingIndex === index ? -1 : index); }}>
                    <span className="receipt-item-icon" aria-hidden="true">{unknown ? <AlertCircle size={19}/> : product.symbol || <ShoppingBag size={18}/>}</span>
                    <span className="receipt-item-description"><strong>{product.title || c.unknownItem}</strong>{product.detail && <span className="receipt-product-size">{product.detail}</span>}<span className="receipt-item-calculation">{String(item.quantity).replace('.',numberLocale.startsWith('en')||numberLocale.startsWith('zh')?'.':',')} {unit} × {displayMoney(item.unitPrice)} {draft.currency}</span>{(unknown || mismatch) && <span className="receipt-item-status"><span aria-hidden="true"/>{unknown ? c.unknownItem : c.refinePrice}</span>}</span>
                    <span className="receipt-item-amount"><b>{displayMoney(expected)}</b><small>{draft.currency}</small></span><ChevronDown size={14} className="receipt-item-chevron"/>
                  </summary>
                  <div className="receipt-item-editor">
                    <ProductTypePicker language={language} value={item.productType||product.type} onChange={id=>chooseProductType(index,id)}/>
                    <div className="receipt-item-name"><label className="receipt-field"><span>{c.name} {index+1}</span><input aria-label={`${c.name} ${index+1}`} aria-invalid={unknown || undefined} value={item.name} maxLength={180} onChange={event => updateItem(index,'name',event.target.value)}/></label><button type="button" aria-label={`${c.remove} ${index+1}`} onClick={() => { setEditingIndex(-1); update({items:draft.items.filter((_,row) => row !== index)}); }}><Trash2 size={17}/></button></div>
                    <div className="receipt-item-numbers">{[['quantity',c.quantity],['unitPrice',c.price],['total',c.lineTotal]].map(([key,label]) => <label className="receipt-field" key={key}><span>{label}</span><input aria-label={`${label} ${index+1}`} readOnly={key==='total'} title={key==='total'?c.calculated:undefined} aria-invalid={key!=='total'&&mismatch || undefined} aria-describedby={mismatch ? `receipt-price-check-${index}` : undefined} inputMode="decimal" value={key==='total'?expected:item[key]} onChange={event => {if(key!=='total')updateItem(index,key,event.target.value);}}/></label>)}</div>
                    {mismatch && <><div className="receipt-price-check" id={`receipt-price-check-${index}`} role="status"><span>{c.readAmount}<b>{displayMoney(item.printedTotal??item.total)} <small>{draft.currency}</small></b></span><span aria-hidden="true">{receiptMoney(item.printedTotal??item.total)===receiptMoney(expected)?'=':'≠'}</span><span>{c.calculated}<b>{displayMoney(expected)} <small>{draft.currency}</small></b></span></div><button type="button" className="receipt-verify-math" disabled={!receiptMoney(expected)} onClick={()=>update({items:draft.items.map((row,number)=>number===index?{...row,total:expected,priceReviewed:true}:row)})}><Check size={14}/>{c.confirmCalculation}</button></>}
                    <label className="receipt-field receipt-unit-field"><span>{c.unit}</span><select aria-label={`${c.unit} ${index+1}`} value={item.unit || 'pcs'} onChange={event => updateItem(index,'unit',event.target.value)}>{['pcs','kg','l'].map(value => <option key={value} value={value}>{c[value]}</option>)}</select></label>
                  </div>
                </details>;
              })}</div>
              {draft.items.length > 0 && <div className="receipt-reconciliation"><p className="receipt-sum">{c.itemSum}<b>{displayMoney(moneyText(validation.sum))} {draft.currency}</b></p>{validation.mismatch && <button type="button" className="receipt-difference" aria-label={c.checkTotal} onClick={focusTotal}><AlertCircle size={14}/><span>{c.shortDifference}</span><b>{displayMoney(moneyText(Math.abs((validation.total || 0)-validation.sum)))} {draft.currency}</b><ChevronRight size={14}/></button>}</div>}
              {needsReview && <button type="button" className="receipt-total-only" aria-label={c.useTotalOnly} onClick={toggleTotalOnly}><ReceiptText size={17}/><span>{c.useTotalOnly}<small>{c.withoutItems}</small></span><ChevronRight size={15}/></button>}
              {omittedItems && <div className="receipt-omitted"><ReceiptText size={16}/><span>{c.withoutItems}</span><button type="button" onClick={toggleTotalOnly}>{c.restoreItems}</button></div>}
              <details className="receipt-raw"><summary>{c.raw}</summary>{draft.evidence && <blockquote className="receipt-evidence">{draft.evidence}</blockquote>}<textarea aria-label={c.raw} value={draft.rawText} maxLength={40000} onChange={event => update({rawText:event.target.value})}/><button type="button" onClick={() => review(draft.rawText)}>{c.reparse}</button></details>
              {!needsReview && <label className="receipt-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>{c.confirm}</span></label>}
            </fieldset>}
            {!draft && !busy && photoChoices}
          </>}
        </div>
        <footer className="receipt-footer"><button type="button" className="receipt-primary" aria-label={actionLabel} disabled={!saved && (busy || (!needsReview && (!confirmed || !validation?.valid)))} onClick={saved ? close : needsReview ? focusCorrection : save}><span>{actionLabel}</span>{!saved && draft && <b aria-hidden="true">{displayMoney(draft.total)} {draft.currency}</b>}</button></footer>
      </div>}
    </dialog>,document.body)}
  </>;
}
