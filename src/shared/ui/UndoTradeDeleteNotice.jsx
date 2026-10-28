import React from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import { calendarDayCopy } from '../i18n/calendarDay.js';
import './UndoTradeDeleteNotice.css';

export default function UndoTradeDeleteNotice({ deletion, language, isLight, floating = false }) {
  const copy = calendarDayCopy(language);
  if (!deletion.notices.length && !deletion.failure) return null;
  return <div className={`trade-delete-notices${floating ? ' trade-delete-notices-floating' : ''}`} data-light={Boolean(isLight)} aria-label={copy.deletionActions}>
    {deletion.notices.map(job => <div key={job.key} className="trade-delete-notice"
      onPointerEnter={event => { if (event.pointerType === 'mouse') deletion.pause(job.key); }}
      onPointerLeave={event => { if (event.pointerType === 'mouse' && !event.currentTarget.contains(document.activeElement)) deletion.resume(job.key); }}
      onFocusCapture={() => deletion.pause(job.key)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) deletion.resume(job.key); }}>
      <Trash2 size={16} aria-hidden="true"/>
      <span role="status">{job.phase === 'waiting' ? copy.deleted : copy.deleting}</span>
      {job.phase === 'waiting' && <button type="button" className="trade-delete-undo" onClick={() => deletion.undo(job.key)}><RotateCcw size={15}/>{copy.undo}</button>}
    </div>)}
    {deletion.failure && <div className="trade-delete-notice trade-delete-error" role="alert"><span>{copy.deleteFailed}</span><button type="button" aria-label={copy.dismiss} onClick={deletion.dismissFailure}><X size={16}/></button></div>}
  </div>;
}
