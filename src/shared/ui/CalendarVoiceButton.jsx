import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import './CalendarVoiceButton.css';

export default function CalendarVoiceButton({language='ru',isLight,onCommand}){
 const locale=language==='en'?'en':language==='ro'||language==='md'?'ro':'ru';
 const text={ru:{start:'Голосовая команда',stop:'Остановить микрофон',hint:'«Добавь запись» или «открой 13 ноября 2048»',invalid:'Не понял команду. Скажите «добавь запись» или «открой 13 ноября 2048».',permission:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Попробуйте ещё раз.',unsupported:'Браузер не поддерживает голосовые команды.'},en:{start:'Voice command',stop:'Stop microphone',hint:'“Add entry” or “open 13 November 2048”',invalid:'Try “add entry” or “open 13 November 2048”.',permission:'Allow microphone access in your browser.',error:'Voice input unavailable. Try again.',unsupported:'Voice commands are not supported by this browser.'},ro:{start:'Comandă vocală',stop:'Oprește microfonul',hint:'„Adaugă o înregistrare” sau „deschide 13 noiembrie 2048”',invalid:'Încearcă „adaugă o înregistrare” sau „deschide 13 noiembrie 2048”.',permission:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Încearcă din nou.',unsupported:'Browserul nu acceptă comenzile vocale.'}}[locale];
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const session=useRef(null),timer=useRef(null),messageTimer=useRef(null);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stop(){const current=session.current;session.current=null;clearTimeout(timer.current);if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();}setListening(false);}
 function notify(value){setMessage(value);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500);}
 useEffect(()=>{
  const cancel=()=>{if(document.hidden){stop();setMessage('');}};
  document.addEventListener('visibilitychange',cancel);
  return ()=>{document.removeEventListener('visibilitychange',cancel);clearTimeout(timer.current);clearTimeout(messageTimer.current);const current=session.current;session.current=null;if(current){current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
 },[]);
 function start(){
  if(session.current){stop();setMessage('');return;}
  if(!Speech){notify(text.unsupported);return;}
  const recognition=new Speech();session.current=recognition;
  recognition.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;
  clearTimeout(messageTimer.current);setListening(true);setMessage(text.hint);
  recognition.onresult=event=>{
   if(session.current!==recognition)return;
   const result=event.results[event.resultIndex];if(!result.isFinal)return;
   const command=parseCalendarVoiceCommand(result[0].transcript);stop();
   if(!command){notify(text.invalid);return;}
   setMessage('');onCommand(command);
  };
  recognition.onerror=event=>{if(session.current!==recognition)return;stop();notify(event.error==='not-allowed'||event.error==='service-not-allowed'?text.permission:text.error);};
  recognition.onend=()=>{if(session.current!==recognition)return;stop();notify(text.invalid);};
  try{recognition.start();timer.current=setTimeout(()=>{if(session.current===recognition){stop();notify(text.invalid);}},12000);}catch{stop();notify(text.error);}
 }
 return <div className="calendar-voice-control" data-light={Boolean(isLight)}>
  <button type="button" className="calendar-voice-button" onClick={start} aria-pressed={listening} aria-label={listening?text.stop:text.start} title={text.start}>{listening?<Square size={15}/>:<Mic size={18}/>}</button>
  {message&&<div className="calendar-voice-message" role="status" aria-live="polite">{message}</div>}
 </div>;
}
