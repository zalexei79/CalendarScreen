import React,{useEffect,useRef,useState} from 'react';
import {LockKeyhole,KeyRound,Copy,Check,X,ShieldCheck,LoaderCircle} from 'lucide-react';
import {createFriendKey,importFriendKey,unlockFriendMessage} from './friendMessage.js';
export default function FriendKeyPanel({copy:t,owner,peer,sample,samples=[],secret,onEnable,onLock,onClose}){
 const [code,setCode]=useState(''),[generated,setGenerated]=useState(false),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false),alive=useRef(true),lock=useRef(false);
 const [mismatch,setMismatch]=useState(false),[replace,setReplace]=useState(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 function generate(){try{setCode(createFriendKey());setGenerated(true);setSaved(false);setCopied(false);setError('');}catch{setError(t.keyUnsupported);}}
 async function enable(e){e.preventDefault();if(lock.current||!code.trim()||(generated&&!saved))return;lock.current=true;setBusy(true);setError('');try{const next=await importFriendKey(code);if(sample&&!generated&&!replace){let opened=false;for(const row of (samples.length?samples:[sample]).slice(-100)){try{await unlockFriendMessage(row.body,next.key,{owner,peer,sender:row.sender_id||(row.direction==='self'?owner:peer),id:row.id});opened=true;break;}catch{/* Try another key generation already present in the loaded history. */}}if(!opened)throw new Error('KEY_MISMATCH');}if(alive.current){setCode('');onEnable(next);}}catch(error){if(alive.current){setError(error.message==='CRYPTO_UNAVAILABLE'?t.keyUnsupported:t.keyBad);if(error.message==='KEY_MISMATCH')setMismatch(true);}}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function copy(){try{await navigator.clipboard.writeText(code);if(alive.current)setCopied(true);}catch{if(alive.current)setError(t.keyCopy);}}
 return <section className="friend-key-panel" aria-label={t.keyTitle}>
  <header><span><LockKeyhole size={21}/></span><div><small>DAYRIS</small><h3>{t.keyTitle}</h3></div><button type="button" aria-label={t.close} disabled={busy} onClick={onClose}><X size={19}/></button></header>
  {secret?<div className="friend-key-enabled"><ShieldCheck size={34}/><h4>{t.keyActive}</h4><p>{t.keyProtected}</p><code>{secret.fingerprint}</code><p>{t.keyHint}</p><button type="button" className="friend-tool-button" onClick={onLock}><LockKeyhole size={16}/>{t.keyLock}</button></div>:<form onSubmit={enable}>
   <p>{t.keyHint}</p><label className="friend-key-field"><span>{t.keyInput}</span><textarea aria-label={t.keyInput} placeholder="DR1-…" value={code} rows={2} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={64} disabled={busy} onChange={e=>{setCode(e.target.value);setGenerated(false);setSaved(false);setCopied(false);setError('');setMismatch(false);setReplace(false);}}/><small>{t.keyCodeHint}</small></label>
   {generated&&<><button type="button" className="friend-tool-button" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?t.copied:t.keyCopy}</button><label className="friend-key-saved"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>{t.keySaved}</label></>}
   {error&&<p className="friend-key-error" role="alert">{error}</p>}
   {mismatch&&!generated&&<label className="friend-key-saved"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/>{t.keyReplace}</label>}{sample&&(generated||mismatch)&&<p>{t.keyReplaceHint}</p>}
   <div className="friend-key-buttons"><button type="button" className="friend-tool-button" disabled={busy} onClick={generate}><KeyRound size={16}/>{sample?t.keyNew:t.keyCreate}</button><button type="submit" className="friend-tool-button is-primary" disabled={busy||!code.trim()||(generated&&!saved)}>{busy?<LoaderCircle size={16}/>:<LockKeyhole size={16}/>} {busy?t.loadingKey:t.keyUse}</button></div>
  </form>}
  <p className="friend-key-meta">{t.keyMeta}</p>
 </section>;
}
