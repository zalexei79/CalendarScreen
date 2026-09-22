import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Check, ChevronDown, CreditCard, House, Pencil, Plus, Repeat2, Smartphone, Wallet, X } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';
import { PLANNER_COPY, plannerLanguage } from './plannerCopy';
import { initialDraft, localDateKey, planPayload, reminderPreview, REMIND_OFFSETS, REPEAT_RULES, validateDraft } from './plannerModel';
import './FinancePlanComposer.css';

const TEMPLATE_ICONS = [CreditCard, Smartphone, House, Wallet];

function ChoiceGroup({ label, values, labels, value, onChange, className = '' }) {
  return <div className={'plan-choices ' + className} role="group" aria-label={label}>
    {values.map((item, index) => <button type="button" key={item} aria-pressed={value === item} onClick={() => onChange(item)}>
      <span>{labels[index]}</span><span className="plan-choice-dot" aria-hidden="true">{value === item && <Check size={10} strokeWidth={3} />}</span>
    </button>)}
  </div>;
}

export default function FinancePlanComposer({ open, dateKey, initialPlan = null, defaultCurrency, language = 'ru', isLight, onClose, onCreate, busy, error }) {
  const copy = PLANNER_COPY[plannerLanguage(language)];
  const id = useId();
  const [draft, setDraft] = useState(() => initialDraft(dateKey, initialPlan, defaultCurrency));
  const [step, setStep] = useState(0);
  const [amountOpen, setAmountOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [validation, setValidation] = useState(null);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const bodyRef = useRef(null);
  const titleRef = useRef(null);
  const lockedRef = useRef(false);
  const callbacksRef = useRef({ onClose, busy });
  callbacksRef.current = { onClose, busy: busy || submitting };
  const locked = busy || submitting;
  const editing = Boolean(initialPlan);

  useEffect(() => {
    if (!open) return;
    const next = initialDraft(dateKey, initialPlan, defaultCurrency);
    setDraft(next);
    setStep(0);
    setAmountOpen(next.amount !== '');
    setLimitOpen(Boolean(next.repeatTotal || next.repeatUntil));
    setCustom(Boolean(next.title && !copy.templates.some(([, title]) => title === next.title)));
    setValidation(null);
    setLocalError('');
    setSubmitting(false);
    lockedRef.current = false;
  }, [open, dateKey, initialPlan?.id, defaultCurrency]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // A non-input focus target keeps the mobile keyboard closed on opening.
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!callbacksRef.current.busy) callbacksRef.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const items = [...panelRef.current.querySelectorAll('button, input, select, [tabindex="0"]')]
        .filter((item) => !item.matches(':disabled') && item.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKey, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidation(null);
    setLocalError('');
  }

  function navigate(next) {
    setStep(next);
    bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  function check(throughStep = 1) {
    const issue = validateDraft(draft);
    if (!issue || issue.step > throughStep) { setValidation(null); return true; }
    setValidation(issue);
    if (issue.field === 'amount') setAmountOpen(true);
    if (issue.field.startsWith('repeat')) setLimitOpen(true);
    navigate(issue.step);
    return false;
  }

  async function save() {
    if (locked || lockedRef.current || !check()) return;
    lockedRef.current = true;
    setSubmitting(true);
    setLocalError('');
    try {
      const planId = initialPlan?.id || globalThis.crypto.randomUUID();
      // Quick save must keep details already entered on other steps.
      await onCreate(planPayload(draft, planId));
    } catch {
      setLocalError(copy.failed);
    } finally {
      lockedRef.current = false;
      setSubmitting(false);
    }
  }

  function advance() {
    if (locked || !check(step)) return;
    navigate(Math.min(step + 1, 2));
  }

  if (!open) return null;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const selectedTemplate = custom ? -1 : copy.templates.findIndex(([, title]) => title === draft.title);
  const EventIcon = TEMPLATE_ICONS[selectedTemplate] || CalendarDays;
  const recurring = draft.repeatRule !== 'none';
  const dayNumber = Number(draft.dateKey?.slice(-2));
  const repeatLabel = draft.repeatRule === 'monthly' ? copy.monthly(dayNumber) : copy.frequencies[REPEAT_RULES.indexOf(draft.repeatRule)];
  const formatDate = (value, withTime = false) => {
    const date = value instanceof Date ? value : new Date(value + 'T12:00:00');
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat(copy.locale, { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(date);
  };
  const reminder = reminderPreview(draft);
  const amountValue = Number(draft.amount.replace(',', '.'));
  const amountLabel = draft.amount.trim() && Number.isFinite(amountValue)
    ? (draft.kind === 'income' ? '+' : '−') + new Intl.NumberFormat(copy.locale, { minimumFractionDigits: Number.isInteger(amountValue) ? 0 : 2, maximumFractionDigits: 2 }).format(amountValue) + ' ' + draft.currency
    : copy.noAmount;
  const limitSummary = [draft.repeatTotal && copy.countSummary(draft.repeatTotal), draft.repeatUntil && copy.untilSummary(formatDate(draft.repeatUntil))].filter(Boolean).join(' · ');
  const fieldError = (field) => validation?.field === field ? id + '-error' : undefined;
  const serverError = error && (String(error).includes('TIME_OUT_OF_RANGE') ? copy.future
    : String(error).includes('INVALID_REPEAT_UNTIL') ? copy.invalidUntil
      : String(error).includes('NO_PUSH_DEVICE') ? copy.push : copy.failed);
  const displayError = validation ? copy[validation.message] : localError || serverError;

  return <div className={'plan-overlay' + (isLight ? ' plan-light' : '')} onMouseDown={(event) => {
    if (event.target === event.currentTarget && !locked) onClose();
  }}>
    <form ref={panelRef} tabIndex={-1} className="plan-dialog" role="dialog" aria-modal="true" aria-labelledby={id + '-heading'} aria-describedby={id + '-description'} aria-busy={locked} noValidate onSubmit={(event) => {
      event.preventDefault();
      if (step === 2) save(); else advance();
    }}>
      <header className="plan-header">
        <div className="plan-brand"><span className="plan-brand-mark" aria-hidden="true"><CalendarDays size={18} /></span><span>DAYRIS<span className="plan-brand-caption">{editing ? copy.editBadge : copy.badge}</span></span></div>
        <button type="button" className="plan-icon-button" onClick={onClose} disabled={locked} aria-label={copy.close}><X size={19} /></button>
      </header>
      <nav className="plan-progress" aria-label={copy.badge}>
        {copy.steps.map((label, index) => <button type="button" key={label} disabled={locked || index > step} aria-current={index === step ? 'step' : undefined} onClick={() => navigate(index)}>
          <span className="plan-step-number">{index < step ? <Check size={12} /> : '0' + (index + 1)}</span><span>{label}</span>
        </button>)}
      </nav>
      <div ref={bodyRef} className="plan-body">
        <div className="plan-intro">
          <h2 ref={headingRef} tabIndex={-1} id={id + '-heading'}>{copy.headings[step]}</h2>
          <p id={id + '-description'}>{copy.descriptions[step]}</p>
        </div>
        <fieldset className="plan-fields" disabled={locked}>
          <div key={step} className="plan-page">
            {step === 0 && <>
              <div className="plan-templates" role="group" aria-label={copy.steps[0]}>
                {copy.templates.map(([label, title, kind], index) => {
                  const Icon = TEMPLATE_ICONS[index];
                  return <button type="button" key={label} aria-pressed={selectedTemplate === index} onClick={() => {
                    setDraft((current) => ({ ...current, title, kind })); setCustom(false); setValidation(null);
                  }}><Icon size={21} strokeWidth={1.5} /><span>{label}</span><span className="plan-template-check" aria-hidden="true">{selectedTemplate === index && <Check size={13} />}</span></button>;
                })}
                <button type="button" className="plan-custom" aria-pressed={custom} onClick={() => {
                  setCustom(true); update('title', ''); titleRef.current?.focus({ preventScroll: true });
                }}><Plus size={21} strokeWidth={1.5} /><span>{copy.custom}<small>{copy.customHint}</small></span><ArrowRight size={16} /></button>
              </div>
              <label className="plan-field plan-title-field"><span>{copy.title}</span>
                <input ref={titleRef} value={draft.title} onChange={(event) => { update('title', event.target.value); setCustom(true); }} maxLength={120} placeholder={copy.placeholder} autoComplete="off" aria-invalid={Boolean(fieldError('title'))} aria-describedby={fieldError('title')} />
              </label>
              <div className="plan-disclosure">
                <button type="button" className="plan-disclosure-toggle" aria-expanded={amountOpen} aria-controls={id + '-amount'} onClick={() => setAmountOpen(!amountOpen)}>
                  <span><Wallet size={17} />{draft.amount ? amountLabel : copy.addAmount}</span><span className="plan-disclosure-meta">{!draft.amount && copy.optional}<ChevronDown size={15} className={amountOpen ? 'plan-rotated' : ''} /></span>
                </button>
                {amountOpen && <div id={id + '-amount'} className="plan-disclosure-content">
                  <div className="plan-amount-row">
                    <label className="plan-field"><span>{copy.amount}</span><input inputMode="decimal" placeholder="0" value={draft.amount} onChange={(event) => update('amount', event.target.value)} aria-invalid={Boolean(fieldError('amount'))} aria-describedby={fieldError('amount')} /></label>
                    <label className="plan-field"><span>{copy.currency}</span><select value={draft.currency} onChange={(event) => update('currency', event.target.value)}>{CURRENCIES.map(({ code }) => <option key={code} value={code}>{code}</option>)}</select></label>
                  </div>
                  <ChoiceGroup label={copy.amount} values={['expense', 'income']} labels={['− ' + copy.expense, '+ ' + copy.income]} value={draft.kind} onChange={(value) => update('kind', value)} className="plan-kind" />
                </div>}
              </div>
              <p className="plan-inline-note"><CalendarDays size={15} /><span>{formatDate(draft.dateKey)} · {draft.time} · {repeatLabel}</span></p>
            </>}

            {step === 1 && <>
              <div className="plan-date-row">
                <label className="plan-field"><span>{recurring ? copy.firstDate : copy.date}</span><input type="date" min={localDateKey(tomorrow)} value={draft.dateKey} onInput={(event) => update('dateKey', event.currentTarget.value)} onChange={(event) => update('dateKey', event.target.value)} aria-invalid={Boolean(fieldError('dateKey'))} aria-describedby={fieldError('dateKey')} /></label>
                <label className="plan-field"><span>{copy.time}</span><input type="time" value={draft.time} onInput={(event) => update('time', event.currentTarget.value)} onChange={(event) => update('time', event.target.value)} /></label>
              </div>
              <div className="plan-setting"><h3>{copy.repeat}</h3><ChoiceGroup label={copy.repeat} values={REPEAT_RULES} labels={copy.frequencies} value={draft.repeatRule} onChange={(value) => update('repeatRule', value)} /></div>
              {recurring && <>
                <p className="plan-repeat-caption">{repeatLabel}{draft.repeatRule === 'monthly' && dayNumber > 28 && <span> {copy.shortMonth}</span>}</p>
                <div className="plan-disclosure plan-limit">
                  <button type="button" className="plan-disclosure-toggle" aria-expanded={limitOpen} aria-controls={id + '-limits'} onClick={() => setLimitOpen(!limitOpen)}>
                    <span>{copy.limit}</span><span className="plan-disclosure-meta">{!limitOpen && (limitSummary || copy.unlimited)}<ChevronDown size={15} className={limitOpen ? 'plan-rotated' : ''} /></span>
                  </button>
                  {limitOpen && <div id={id + '-limits'} className="plan-disclosure-content">
                    <label className="plan-field"><span>{copy.total}</span><select value={draft.repeatTotal} onChange={(event) => update('repeatTotal', event.target.value)} aria-invalid={Boolean(fieldError('repeatTotal'))} aria-describedby={fieldError('repeatTotal')}>
                      <option value="">{copy.unlimited}</option>{Array.from({ length: 600 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select></label>
                    <div className="plan-count-presets" role="group" aria-label={copy.total}>{[6, 12, 24].map((value) => <button type="button" key={value} aria-pressed={draft.repeatTotal === String(value)} onClick={() => update('repeatTotal', String(value))}>{value}</button>)}</div>
                    <label className="plan-field"><span>{copy.until} <em>{copy.optional}</em></span><input type="date" min={draft.dateKey} value={draft.repeatUntil} onInput={(event) => update('repeatUntil', event.currentTarget.value)} onChange={(event) => update('repeatUntil', event.target.value)} aria-invalid={Boolean(fieldError('repeatUntil'))} aria-describedby={fieldError('repeatUntil')} /></label>
                    <p className="plan-fine-print">{copy.limitsHint}</p>
                  </div>}
                </div>
              </>}
              <div className="plan-setting plan-notify"><h3><Bell size={16} />{copy.notify}</h3><ChoiceGroup label={copy.notify} values={REMIND_OFFSETS} labels={copy.offsets} value={draft.remindOffset} onChange={(value) => update('remindOffset', value)} /></div>
              <p className="plan-inline-note"><Bell size={15} /><span>{formatDate(reminder.date, true)}<small>{copy.localTime}</small></span></p>
              {reminder.late && <p className="plan-warning">{copy.late}</p>}
            </>}

            {step === 2 && <>
              <div className="plan-review">
                <div className="plan-review-top"><span className="plan-review-icon"><EventIcon size={24} strokeWidth={1.5} /></span><button type="button" className="plan-icon-button" onClick={() => navigate(0)} aria-label={copy.change + ': ' + copy.steps[0]}><Pencil size={16} /></button></div>
                <h3>{draft.title}</h3><p className={'plan-review-amount' + (draft.amount ? '' : ' plan-no-amount')}>{amountLabel}</p>
                <div className="plan-review-divider" />
                <button type="button" className="plan-review-row" onClick={() => navigate(1)} aria-label={copy.change + ': ' + copy.date}><CalendarDays size={18} /><span><small>{recurring ? copy.firstDate : copy.date}</small><strong>{formatDate(draft.dateKey)} · {draft.time}</strong></span><Pencil size={14} /></button>
                <button type="button" className="plan-review-row" onClick={() => navigate(1)} aria-label={copy.change + ': ' + copy.repeat}><Repeat2 size={18} /><span><small>{copy.steps[1]}</small><strong>{repeatLabel}</strong>{recurring && <small>{limitSummary || copy.unlimited}</small>}</span><Pencil size={14} /></button>
                <button type="button" className="plan-review-row" onClick={() => navigate(1)} aria-label={copy.change + ': ' + copy.notification}><Bell size={18} /><span><small>{copy.firstNotification}</small><strong>{formatDate(reminder.date, true)}</strong><small>{copy.offsets[REMIND_OFFSETS.indexOf(draft.remindOffset)]} · {copy.localTime}</small></span><Pencil size={14} /></button>
              </div>
              {reminder.late && <p className="plan-warning">{copy.late}</p>}
              <p className="plan-review-note"><Check size={16} /><span>{editing ? copy.editNote : copy.note}</span></p>
            </>}
          </div>
        </fieldset>
      </div>
      <footer className="plan-footer">
        {displayError && <p id={id + '-error'} role="alert" className="plan-error">{displayError}</p>}
        <div className="plan-actions">
          {step === 0 ? <button type="button" className="plan-secondary" disabled={locked || !draft.title.trim()} onClick={save}>{editing ? copy.saveNow : copy.createNow}</button>
            : <button type="button" className="plan-secondary plan-back" disabled={locked} onClick={() => navigate(step - 1)}><ArrowLeft size={17} />{copy.back}</button>}
          <button type="submit" className="plan-primary" disabled={locked || (step === 0 && !draft.title.trim())}>
            {locked ? copy.saving : step === 0 ? copy.details : step === 1 ? copy.review : editing ? copy.save : copy.create}
            {!locked && (step === 2 ? <Check size={17} /> : <ArrowRight size={17} />)}
          </button>
        </div>
      </footer>
    </form>
  </div>;
}
