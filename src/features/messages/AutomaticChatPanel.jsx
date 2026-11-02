import React from 'react';
import {LockKeyhole,ShieldCheck,X,RefreshCw} from 'lucide-react';
export default function AutomaticChatPanel({copy:t,security,onClose,legacy,onLegacy,retryLabel,closeLabel}){
 return <section className="friend-key-panel" aria-label={t.title}><header><span><LockKeyhole size={21}/></span><div><small>DAYRIS</small><h3>{t.title}</h3></div><button type="button" aria-label={closeLabel} onClick={onClose}><X size={19}/></button></header><div className="friend-key-enabled"><ShieldCheck size={34}/><h4>{security.ready?t.active:security.status==='waiting'?t.waiting:security.status==='error'?t.error:t.loading}</h4><p>{t.description}</p>{!security.ready&&<button type="button" className="friend-tool-button" onClick={security.retry}><RefreshCw size={15}/>{retryLabel}</button>}</div><p className="friend-key-meta">{t.storage}</p>{legacy&&<button type="button" className="friend-tool-button" onClick={onLegacy}>{t.legacy}</button>}</section>;
}
