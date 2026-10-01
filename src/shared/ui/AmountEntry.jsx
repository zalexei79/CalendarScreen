import React, {useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Delete, Mic, Square} from 'lucide-react';
import {parseSpokenAmount} from '../lib/spokenAmount.js';
import './AmountEntry.css';

export function editAmount(value, key) {
  const current=String(value || '').replace(',', '.');
  if(key==='delete') return current.slice(0,-1);
  if(key==='clear') return '';
  if(key==='.') return current.includes('.') ? current : `${current || '0'}.`;
  if(!/^\d$/.test(key)) return current;
  if(current.replace('.','').length>=14) return current;
  return current==='0' ? key : current+key;
}

export const AmountInput=React.forwardRef(function AmountInput(props,ref) {
  const input=useRef(null),previous=useRef(props.value);
  useImperativeHandle(ref,()=>input.current,[]);
  useEffect(()=>{
    const changed=previous.current!==props.value;previous.current=props.value;
    if(!changed||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const animation=input.current?.animate([{opacity:.78},{opacity:1}],{duration:160,easing:'ease-out'});
    return ()=>animation?.cancel();
  },[props.value]);
  const [touch,setTouch]=useState(()=>window.matchMedia('(pointer:coarse)').matches);
  useEffect(()=>{
    const query=window.matchMedia('(pointer:coarse)');
    const change=()=>setTouch(query.matches);
    query.addEventListener('change',change);
    return ()=>query.removeEventListener('change',change);
  },[]);
  return <input {...props} ref={input} autoFocus={false} readOnly={touch} inputMode={touch ? 'none' : 'decimal'}/>;
});

export default function AmountKeypad({value,onChange,language='ru',isLight}) {
  const locale=language==='en'?'en':language==='md'||language==='ro'?'ro':'ru';
  const speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  const session=useRef(null), timeout=useRef(null);
  const [listening,setListening]=useState(false),[message,setMessage]=useState('');
  const voice={ru:{start:'Назвать сумму',stop:'Остановить',listen:'Назовите только сумму',invalid:'Не понял сумму. Скажите, например: сто двадцать пять.',denied:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Введите сумму вручную.',done:'Сумма заполнена — проверьте перед сохранением.',unsupported:'Браузер не поддерживает голосовой ввод.'},en:{start:'Speak amount',stop:'Stop',listen:'Say only the amount',invalid:'Amount not recognized. Try: one hundred twenty five.',denied:'Allow microphone access in your browser.',error:'Voice input unavailable. Enter the amount manually.',done:'Amount entered — check before saving.',unsupported:'Voice input is not supported by this browser.'},ro:{start:'Spune suma',stop:'Oprește',listen:'Spune doar suma',invalid:'Suma nu a fost recunoscută. Încearcă: o sută douăzeci și cinci.',denied:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Introdu suma manual.',done:'Suma a fost introdusă — verifică înainte de salvare.',unsupported:'Browserul nu acceptă introducerea vocală.'}}[locale];
  function cancel() {
    const current=session.current;session.current=null;clearTimeout(timeout.current);
    if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();}
    setListening(false);
  }
  useEffect(()=>{
    setListening(false);setMessage('');
    const stop=()=>{if(document.hidden)cancel();};
    document.addEventListener('visibilitychange',stop);
    return ()=>{document.removeEventListener('visibilitychange',stop);const current=session.current;session.current=null;clearTimeout(timeout.current);if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
  },[language]);
  useEffect(()=>{if(session.current){cancel();setMessage('');}},[value]);
  function change(next){cancel();setMessage('');onChange(next);}
  function startVoice(){
    if(session.current){cancel();setMessage('');return;}
    if(!speech)return;
    const recognition=new speech();session.current=recognition;
    recognition.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];
    recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
    setListening(true);setMessage(voice.listen);
    recognition.onresult=event=>{
      if(session.current!==recognition)return;
      const result=event.results[event.resultIndex];if(!result.isFinal)return;
      const amount=parseSpokenAmount(result[0].transcript);
      cancel();setMessage(amount===null?voice.invalid:voice.done);
      if(amount!==null)onChange(amount);
    };
    recognition.onerror=event=>{if(session.current!==recognition)return;cancel();setMessage(event.error==='not-allowed'||event.error==='service-not-allowed'?voice.denied:voice.error);};
    recognition.onend=()=>{if(session.current!==recognition)return;session.current=null;clearTimeout(timeout.current);setListening(false);setMessage(voice.invalid);};
    try{recognition.start();timeout.current=setTimeout(()=>{if(session.current===recognition){cancel();setMessage(voice.invalid);}},12000);}catch{cancel();setMessage(voice.error);}
  }
  const copy={ru:['Ввод суммы','Удалить цифру','Очистить','Быстрые суммы'],en:['Enter amount','Delete digit','Clear','Quick amounts'],ro:['Introdu suma','Șterge cifra','Golește','Sume rapide']}[locale];
  return <div className="amount-keypad" data-light={Boolean(isLight)} role="group" aria-label={copy[0]}>
    <div className="amount-tools"><span>{copy[3]}</span><button type="button" className="amount-mic" disabled={!speech} title={!speech?voice.unsupported:voice.start} aria-label={listening?voice.stop:voice.start} aria-pressed={listening} onClick={startVoice}>{listening?<Square size={14}/>:<Mic size={16}/>}<span>{listening?voice.stop:voice.start}</span></button></div>
    <div className="amount-voice-status" role="status" aria-live="polite" data-active={Boolean(message)}>{message}</div>
    <div className="amount-presets" role="group" aria-label={copy[3]}>
      {[10,50,100,500].map(amount=><button type="button" key={amount} onClick={()=>change(String(amount))} data-selected={value===String(amount)}>{amount}</button>)}
      <button type="button" onClick={()=>change('')} disabled={!value}>{copy[2]}</button>
    </div>
    <div className="amount-digits">
      {['1','2','3','4','5','6','7','8','9','.','0','delete'].map(key=><button type="button" key={key} aria-label={key==='delete'?copy[1]:key} onClick={()=>change(editAmount(value,key))}>{key==='delete'?<Delete size={18}/>:key==='.'?',':key}</button>)}
    </div>
  </div>;
}
