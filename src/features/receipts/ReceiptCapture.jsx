import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Camera, Check, ChevronDown, Plus, ReceiptText, ShoppingBag, Trash2, X } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';
import { localDateKey } from '../../shared/lib/voiceEntryReview.js';
import { checkReceiptAccess } from './receiptAccess.js';
import { recognizeReceipt } from './receiptOcr.js';
import { receiptLineTotal, receiptMoney, moneyText, receiptValidation, receiptItemAmount, receiptItemMathIssue, validReceiptDate, validReceiptName, receiptProduct, receiptCategory } from './receiptModel.js';
import {parseReceiptPhoto} from './receiptPhoto.js';
import ReceiptOverview from './ReceiptOverview.jsx';
import { receiptCopy } from './receiptCopy.js';
import {readProductMemory,rememberProductType,recalledProductType} from './productMemory.js';
import {productTypeById,productLocale} from './productCatalog.js';
import ProductTypePicker from './ProductTypePicker.jsx';
import './ReceiptCapture.css';
import ReceiptScanner from './ReceiptScanner.jsx';
import {openReceiptGallery} from './receiptGallery.js';

export default function ReceiptCapture(props) {
  if (!props.userId || !props.proActive || props.proLoading) return null;
  return <ReceiptCaptureSession key={props.userId} {...props}/>;
}

function ReceiptCaptureSession({ userId, language = 'ru', isLight, defaultCurrency='',defaultDateKey, onAccessDenied, onSaveReceipt, checkAccess = checkReceiptAccess, recognize = recognizeReceipt }) {
  const c = receiptCopy(language), today = localDateKey();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(null), [preview, setPreview] = useState('');
  const [phase, setPhase] = useState('idle'), [progress, setProgress] = useState(0), [error, setError] = useState(''), [saved, setSaved] = useState(null);
  const [ocrStage,setOcrStage]=useState('preparing');
  const [editingIndex, setEditingIndex] = useState(-1), [metadataOpen, setMetadataOpen] = useState(false);
  const [includeItems, setIncludeItems] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const selectedFile = useRef(null), attempts=useRef(0);
  const [productMemory,setProductMemory]=useState(()=>readProductMemory(userId));
  const gallery = useRef(null), camera = useRef(null), dialog = useRef(null), trigger = useRef(null), generation = useRef(0), abort = useRef(null), busySave = useRef(false), mounted = useRef(false), currentOwner = useRef(userId);
  currentOwner.current = userId;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; abort.current?.abort(); }; }, []);
  useEffect(() => { generation.current++; abort.current?.abort(); setOpen(false); setDraft(null); setPreview(''); setSaved(null); setError(''); setPhase('idle'); setProductMemory(readProductMemory(userId)); }, [userId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) { dialog.current.showModal(); dialog.current.querySelector('#receipt-title')?.focus({preventScroll:true}); }
    if (!open && dialog.current?.open) { dialog.current.close(); trigger.current?.focus(); }
  }, [open]);
  const busy = phase === 'reading' || phase === 'checking' || phase === 'saving';
  function close() { if (busySave.current) return; generation.current++; abort.current?.abort(); selectedFile.current = null; setOpen(false); setDraft(null); setPreview(''); setSaved(null); setError(''); setPhase('idle'); }
  function denyAccess() {
    generation.current++; abort.current?.abort(); selectedFile.current = null;
    setAccessDenied(true); setOpen(false); setDraft(null); setPreview('');
    onAccessDenied?.();
  }
  function choose() {
    attempts.current=0;setDraft(null);setPreview('');setError('');setOpen(true);setPhase('scanner');
  }
  function rescan(){setDraft(null);setError('');setPhase('scanner');}
  function manual(){if(!draft)review('');setError('');setPhase('review');requestAnimationFrame(focusTotal);}
  function update(next) { setDraft(previous => ({ ...previous, ...next })); setError(''); }
  function review(text) {
    const parsed = parseReceiptPhoto(text,{today,defaultDateKey:defaultDateKey||today,defaultCurrency:CURRENCIES.some(item=>item.code===defaultCurrency)?defaultCurrency:''});
    const memory=readProductMemory(userId);setProductMemory(memory);
    parsed.items=parsed.items.map(item=>({...item,productType:recalledProductType(memory,item.name)}));
    parsed.category=receiptCategory(parsed.items);
    setIncludeItems(true);
    setDraft(parsed);setEditingIndex(-1);
    setMetadataOpen(false);
    return parsed;
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
  async function selectFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    await readFile(file);
  }
  async function readFile(file) {
    if (!file || busySave.current || accessDenied || !mounted.current) return;
    selectedFile.current = file;
    const request = ++generation.current, owner = userId;
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const alive = () => mounted.current && request === generation.current && currentOwner.current === owner;
    setOpen(true); setDraft(null); setSaved(null); setPreview(''); setError(''); setProgress(0);
    if (!/^image\/(?:jpeg|png|webp|bmp)$/i.test(file.type) || file.size > 20 * 1024 * 1024) { setPhase('review'); setError(c.file); return; }
    setPreview(URL.createObjectURL(file)); setPhase('checking');
    try {
      if (!await checkAccess(owner)) { if (alive()) denyAccess(); return; }
      if (!alive()) return;
      setPhase('reading');setOcrStage('preparing');attempts.current++;
      const text = await recognize(file, { language, signal: controller.signal, onStage: value=>{if(alive())setOcrStage(value);},onProgress: value => { if (alive()) setProgress(previous=>Math.max(previous,value)); } });
      if (alive()) { const parsed=review(text);setPhase(!parsed.total&&!parsed.totalCandidates?.length&&!parsed.documentIssue&&!parsed.items.length?'scan-failed':'review'); }
    } catch (failure) {
      if (!alive()) return;
      setError(failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? c.access : failure.message==='OCR_TIMEOUT'?c.ocrTimeout:'');
      // Access failure must not expose a manually writable receipt form.
      if (failure.message !== 'RECEIPT_ACCESS_UNAVAILABLE') review('');
      setPhase(failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? 'access-error' : 'scan-failed');
    }
  }
  const validation = draft ? receiptValidation(draft, today, CURRENCIES.map(item => item.code)) : null;
  const documentIssue = draft?.documentIssue || '';
  const requiredField = draft ? !(receiptMoney(draft.total)>0)?'total':!CURRENCIES.some(item=>item.code===draft.currency)?'currency':!validReceiptDate(draft.dateKey,today)?'date':'' : '';
  function focusTotal() {
    const input = dialog.current?.querySelector('.receipt-total input');
    input?.focus({preventScroll:true}); input?.scrollIntoView({block:'nearest'});
  }
  function focusRequired(){
    if(requiredField==='total'){focusTotal();return;}
    const input=dialog.current?.querySelector(requiredField==='currency'?'.receipt-currency-control select':'.receipt-context input[type="date"]');
    input?.focus({preventScroll:true});input?.scrollIntoView({block:'nearest'});try{input?.showPicker?.();}catch{}
  }
  const retryAccess = phase === 'access-error';
  const actionLabel = saved ? c.done : retryAccess ? c.retryAccess : phase === 'saving' ? c.saving : documentIssue ? c.gallery : requiredField ? (requiredField==='total'?c.enterAmount:requiredField==='currency'?c.chooseCurrency:c.chooseDate) : c.save;
  async function save() {
    if (busySave.current || !validation?.valid) return;
    const owner = userId, request = generation.current;
    busySave.current = true; setPhase('saving'); setError('');
    const snapshot = structuredClone(draft);
    if(!includeItems)snapshot.items=[];
    try {
      if (!await checkAccess(owner)) { if (currentOwner.current === owner && request === generation.current && mounted.current) denyAccess(); return; }
      if (currentOwner.current !== owner || request !== generation.current || !mounted.current) return;
      const result = await onSaveReceipt(snapshot, owner);
      if (currentOwner.current === owner && request === generation.current && mounted.current) { setSaved({ ...snapshot, ...result }); setPhase('saved'); }
    } catch (failure) {
      if (currentOwner.current === owner && request === generation.current && mounted.current) {
        if (failure.message === 'RECEIPT_ACCESS_DENIED') { denyAccess(); return; }
        setError(failure.message === 'RECEIPT_DUPLICATE' ? c.duplicate : failure.message === 'RECEIPT_ACCESS_UNAVAILABLE' ? c.access : c.saveError); setPhase('review');
      }
    } finally { busySave.current = false; }
  }
  const numberLocale = String(language).startsWith('zh') ? 'zh-CN' : ['md','ro'].includes(language) ? 'ro-MD' : language === 'en' ? 'en-US' : 'ru-RU';
  const displayMoney = value => { const minor = receiptMoney(value); return minor === null ? '—' : new Intl.NumberFormat(numberLocale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100); };
  const photoChoices = <div className="receipt-choose"><button type="button" onClick={rescan}><Camera size={16}/>{c.camera}</button><button type="button" onClick={() => gallery.current?.click()}>{c.gallery}</button></div>;
  if (accessDenied) return null;
  return <>
    <button ref={trigger} type="button" className="receipt-launch" data-light={isLight} aria-label={`${c.photo} · PRO`} title={`${c.photo} · PRO`} onClick={choose}><Camera size={20}/></button>
    <input ref={gallery} className="receipt-file" type="file" accept="image/*" aria-label={c.gallery} onChange={selectFile}/>
    <input ref={camera} className="receipt-file" type="file" accept="image/*" capture="environment" aria-label={c.camera} onChange={selectFile}/>
    {createPortal(<dialog ref={dialog} className="receipt-dialog" data-scanner={phase==='scanner'} data-light={isLight} aria-labelledby="receipt-title" onCancel={event => { event.preventDefault(); close(); }}>
      {open && (phase==='scanner'?<ReceiptScanner c={c} onClose={close} onFile={readFile} onGallery={()=>openReceiptGallery(gallery.current)} onNativeCamera={()=>camera.current?.click()}/>:<div className="receipt-shell">
        <header className="receipt-heading"><div><small>DAYRIS <b>PRO</b></small><h2 id="receipt-title" tabIndex={-1}>{draft?.kind==='amount'?c.photoTitle:c.title}</h2></div><button type="button" aria-label={c.close} disabled={phase === 'saving'} onClick={close}><X size={20}/></button></header>
        <div className="receipt-scroll">
          {saved ? <div className="receipt-success" role="status"><Check size={32}/><h3>{c.saved}</h3><strong>{moneyText(receiptMoney(saved.total))} {saved.currency}</strong><p>{saved.dateKey}</p>{saved.dayTotal !== undefined && <p>{c.dayTotal}: <b>{saved.dayTotal} {saved.currency}</b></p>}</div> : <>
            {preview && <details className="receipt-preview" open={!draft}><summary><img src={preview} alt=""/><span>{c.sourcePhoto}</span><ChevronDown size={14}/></summary><a href={preview} target="_blank" rel="noreferrer"><img src={preview} alt={c.sourcePhoto}/></a>{draft && !busy && photoChoices}</details>}
            {(phase === 'reading' || phase === 'checking') && <div className="receipt-progress" role="status"><strong>{phase==='reading'?(c['ocr'+ocrStage]||c.reading):c.reading} {phase === 'reading' ? `${progress}%` : ''}</strong><progress max="100" value={progress}/><p>{phase==='checking'||ocrStage==='preparing'?c.loading:c.ocrLocal}</p></div>}
            {error && <p className="receipt-warning" role="alert">{error}</p>}
            {phase==='scan-failed' && <section className="receipt-scan-failed" role="status"><ReceiptText size={28}/><h3>{attempts.current>1?c.scanFailedAgain:c.scanFailed}</h3><p>{attempts.current>1?c.scanManualHint:c.scanRetryHint}</p><button type="button" className="receipt-primary" onClick={attempts.current>1?manual:rescan}>{attempts.current>1?c.scanManual:c.scanRetry}</button><button type="button" onClick={attempts.current>1?rescan:manual}>{attempts.current>1?c.scanRetry:c.scanManual}</button></section>}
            {draft && phase!=='scan-failed' && <fieldset disabled={busy} className="receipt-fields"><legend className="receipt-sr-only">{c.review}</legend>
              <ReceiptOverview draft={draft} c={c} today={today} language={language} busy={busy} update={update} metadataOpen={metadataOpen} setMetadataOpen={setMetadataOpen}/>
              {documentIssue && <p className="receipt-document-status" role="status"><AlertCircle size={16}/><span>{c[documentIssue]}</span></p>}
              {draft.items.length>0 && <><div className="receipt-section-title"><h3>{c.items} <small>{draft.items.length}</small></h3><button type="button" aria-label={c.add} onClick={() => { setIncludeItems(true);setEditingIndex(draft.items.length); update({items:[...draft.items,{name:'',quantity:'1',unit:'pcs',unitPrice:'',total:''}]}); }}><Plus size={18}/></button></div><label className="receipt-list-choice"><span><strong>{c.saveList}</strong><small>{includeItems?c.listIncluded:c.totalOnly}</small></span><input type="checkbox" role="switch" aria-label={c.saveList} checked={includeItems} onChange={event=>{setIncludeItems(event.target.checked);setEditingIndex(-1);}}/></label></>}
              {draft.kind==='receipt'&&!draft.items.length&&<button type="button" className="receipt-add-empty" onClick={()=>{setIncludeItems(true);setEditingIndex(0);update({items:[{name:'',quantity:'1',unit:'pcs',unitPrice:'',total:''}]});}}><Plus size={14}/>{c.add}</button>}
              <div className="receipt-items">{includeItems&&draft.items.map((item,index) => {
                const product = receiptProduct(item.name,language,item.productType), expected = receiptLineTotal(item.quantity,item.unitPrice), mismatch = receiptItemMathIssue(item), unknown = !validReceiptName(item.name);
                const unit = c[item.unit] || c.pcs;
                return <details className="receipt-item" data-issue={mismatch || unknown} key={index} open={editingIndex === index}>
                  <summary className="receipt-item-summary" aria-label={`${c.editItem} ${index+1}`} onClick={event => { event.preventDefault(); setEditingIndex(editingIndex === index ? -1 : index); }}>
                    <span className="receipt-item-icon" aria-hidden="true">{unknown ? <AlertCircle size={19}/> : product.symbol || <ShoppingBag size={18}/>}</span>
                    <span className="receipt-item-description"><strong>{product.title || c.unknownItem}</strong>{product.detail && <span className="receipt-product-size">{product.detail}</span>}<span className="receipt-item-calculation">{(String(item.quantity??'').trim()||'—').replace('.',numberLocale.startsWith('en')||numberLocale.startsWith('zh')?'.':',')} {unit}{expected?<> × {displayMoney(item.unitPrice)} {draft.currency}</>:<> · {c.itemPriceMissing}</>}</span>{(unknown || mismatch) && <span className="receipt-item-status"><span aria-hidden="true"/>{unknown ? c.unknownItem : c.itemUncertain}</span>}</span>
                    <span className="receipt-item-amount"><b>{displayMoney(receiptItemAmount(item))}</b><small>{draft.currency}</small></span><ChevronDown size={14} className="receipt-item-chevron"/>
                  </summary>
                  <div className="receipt-item-editor">
                    <ProductTypePicker language={language} value={item.productType||product.type} onChange={id=>chooseProductType(index,id)}/>
                    <div className="receipt-item-name"><label className="receipt-field"><span>{c.name} {index+1}</span><input aria-label={`${c.name} ${index+1}`} aria-invalid={unknown || undefined} value={item.name} maxLength={180} onChange={event => updateItem(index,'name',event.target.value)}/></label><button type="button" aria-label={`${c.remove} ${index+1}`} onClick={() => { setEditingIndex(-1); update({items:draft.items.filter((_,row) => row !== index)}); }}><Trash2 size={17}/></button></div>
                    <div className="receipt-item-numbers">{[['quantity',c.quantity],['unitPrice',c.price],['total',c.lineTotal]].map(([key,label]) => <label className="receipt-field" key={key}><span>{label}</span><input aria-label={`${label} ${index+1}`} readOnly={key==='total'} title={key==='total'?c.calculated:undefined} aria-invalid={key!=='total'&&mismatch || undefined} aria-describedby={mismatch ? `receipt-price-check-${index}` : undefined} inputMode="decimal" value={(key==='total'?expected:item[key])??''} onChange={event => {if(key!=='total')updateItem(index,key,event.target.value);}}/></label>)}</div>
                    {mismatch && <><div className="receipt-price-check" id={`receipt-price-check-${index}`} role="status"><span>{c.readAmount}<b>{displayMoney(item.printedTotal??item.total)} <small>{draft.currency}</small></b></span><span aria-hidden="true">{receiptMoney(item.printedTotal??item.total)===receiptMoney(expected)?'=':'≠'}</span><span>{c.calculated}<b>{displayMoney(expected)} <small>{draft.currency}</small></b></span></div></>}
                    <label className="receipt-field receipt-unit-field"><span>{c.unit}</span><select aria-label={`${c.unit} ${index+1}`} value={item.unit || 'pcs'} onChange={event => updateItem(index,'unit',event.target.value)}>{['pcs','kg','l'].map(value => <option key={value} value={value}>{c[value]}</option>)}</select></label>
                  </div>
                </details>;
              })}</div>
              {includeItems&&draft.items.length > 0 && <div className="receipt-reconciliation"><p className="receipt-sum">{c.itemSum}<b>{displayMoney(moneyText(validation.sum))} {draft.currency}</b></p>{validation.mismatch && <p className="receipt-difference" role="status"><AlertCircle size={14}/><span>{c.shortDifference}</span><b>{displayMoney(moneyText(Math.abs((validation.total || 0)-validation.sum)))} {draft.currency}</b></p>}</div>}
              <details className="receipt-raw"><summary>{c.raw}</summary>{draft.evidence && <blockquote className="receipt-evidence">{draft.evidence}</blockquote>}<textarea aria-label={c.raw} value={draft.rawText} maxLength={40000} onChange={event => update({rawText:event.target.value})}/><button type="button" onClick={() => review(draft.rawText)}>{c.reparse}</button></details>
            </fieldset>}
            {!draft && !busy && !retryAccess && phase!=='scan-failed' && photoChoices}
          </>}
        </div>
        {phase!=='scan-failed' && <footer className="receipt-footer"><button type="button" className="receipt-primary" aria-label={actionLabel} disabled={!saved && !retryAccess && (busy || (!documentIssue && !requiredField && !validation?.valid))} onClick={saved ? close : retryAccess ? () => readFile(selectedFile.current) : documentIssue ? () => gallery.current?.click() : requiredField ? focusRequired : save}><span>{actionLabel}</span>{!saved && draft && !documentIssue && receiptMoney(draft.total)>0 && <b aria-hidden="true">{displayMoney(draft.total)} {draft.currency}</b>}</button></footer>}
      </div>)}
    </dialog>,document.body)}
  </>;
}
