import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,X} from 'lucide-react';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import './CalendarVoiceButton.css';

export default function CalendarVoiceButton({language='ru',isLight,traderMode=false,onCommand}){
 const locale=language==='en'?'en':language==='ro'||language==='md'?'ro':'ru';
 const text={ru:{start:'Голосовая команда',stop:'Остановить микрофон',hint:'«Добавь запись» или «открой 13 ноября 2048»',invalid:'Не понял эту фразу. Попробуйте сказать иначе или выбрать пример ниже.',permission:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Попробуйте ещё раз.',unsupported:'Браузер не поддерживает голосовые команды.'},en:{start:'Voice command',stop:'Stop microphone',hint:'“Add entry” or “open 13 November 2048”',invalid:'Try “add entry” or “open 13 November 2048”.',permission:'Allow microphone access in your browser.',error:'Voice input unavailable. Try again.',unsupported:'Voice commands are not supported by this browser.'},ro:{start:'Comandă vocală',stop:'Oprește microfonul',hint:'„Adaugă o înregistrare” sau „deschide 13 noiembrie 2048”',invalid:'Încearcă „adaugă o înregistrare” sau „deschide 13 noiembrie 2048”.',permission:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Încearcă din nou.',unsupported:'Browserul nu acceptă comenzile vocale.'}}[locale];
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState(''),[speaking,setSpeaking]=useState(false);
 const [active,setActive]=useState(false),[phase,setPhase]=useState('idle'),[transcript,setTranscript]=useState(''),[audioError,setAudioError]=useState('');
 const audioTimer=useRef(null),releaseTimer=useRef(null);
 const [talking,setTalking]=useState(false);
 const speechPulseTimer=useRef(null);
 const ui={ru:{opening:'Включаю микрофон…',listen:'Слушаю — говорите',processing:'Обрабатываю…',done:'Готово — обработать фразу',hint:'После паузы команда отправится сама. Или нажмите «Готово».',audio:'Звук не запустился. Нажмите «Прослушать ответ».',close:'Закрыть голосовой режим'},en:{opening:'Starting microphone…',listen:'Listening — speak now',processing:'Processing…',done:'Done — send phrase',hint:'Pause to send automatically, or tap Done.',audio:'Audio did not start. Tap Listen to answer.',close:'Close voice mode'},ro:{opening:'Pornesc microfonul…',listen:'Ascult — vorbește acum',processing:'Procesez…',done:'Gata — trimite fraza',hint:'Pauza trimite automat. Sau apasă Gata.',audio:'Sunetul nu a pornit. Apasă Ascultă răspunsul.',close:'Închide modul vocal'}}[locale];
 const utterance=useRef(null);
 const audioText={ru:{play:'Прослушать ответ',stop:'Остановить ответ',close:'Закрыть ответ'},en:{play:'Listen to answer',stop:'Stop answer',close:'Close answer'},ro:{play:'Ascultă răspunsul',stop:'Oprește răspunsul',close:'Închide răspunsul'}}[locale];
 const financeHelp={ru:['Сколько я потратил за этот месяц','Сколько я заработал за этот месяц','Подведи итог за этот месяц'],en:['How much did I spend this month','How much did I earn this month','Summarize this month'],ro:['Cât am cheltuit luna aceasta','Cât am câștigat luna aceasta','Rezumat pentru luna aceasta']}[locale];
 function stopSpeaking(){clearTimeout(audioTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}setSpeaking(false);}
 function speak(value){
  stopSpeaking();setAudioError('');if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){setAudioError(ui.audio);return;}
  const speech=new window.SpeechSynthesisUtterance(value);utterance.current=speech;
  speech.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];speech.rate=.98;speech.volume=1;
  const voices=window.speechSynthesis.getVoices();speech.voice=voices.find(v=>v.lang===speech.lang)||voices.find(v=>v.lang.toLowerCase().startsWith(locale))||null;
  const finish=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);utterance.current=null;setSpeaking(false);}};
  speech.onstart=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);setSpeaking(true);}};
  speech.onend=finish;speech.onerror=()=>{finish();setAudioError(ui.audio);};
  audioTimer.current=setTimeout(()=>{if(utterance.current===speech){stopSpeaking();setAudioError(ui.audio);}},3500);
  try{if(window.speechSynthesis.paused)window.speechSynthesis.resume();window.speechSynthesis.speak(speech);}catch{speech.onerror();}
 }
 const help={ru:{title:'Что можно сказать',list:['Добавь запись','Сегодня я потратил 50 рублей','Сегодня я получил 50 евро','Открой 13 ноября 2048'],trade:'Добавь сделку',note:'Сумма и валюта заполнятся в форме. Проверьте запись перед сохранением.',listening:'Слушаю…'},en:{title:'Try these commands',list:['Add entry','Today I spent 50 euros','Today I received 50 dollars','Open 13 November 2048'],trade:'Add trade',note:'Amount and currency fill the form. Review the entry before saving.',listening:'Listening…'},ro:{title:'Comenzi disponibile',list:['Adaugă o înregistrare','Astăzi am cheltuit 50 lei','Astăzi am primit 50 euro','Deschide 13 noiembrie 2048'],trade:'Adaugă o tranzacție',note:'Suma și moneda se completează în formular. Verifică înainte de salvare.',listening:'Ascult…'}}[locale];
 const session=useRef(null),timer=useRef(null),messageTimer=useRef(null);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stop(){const current=session.current;session.current=null;clearTimeout(speechPulseTimer.current);setTalking(false);clearTimeout(timer.current);clearTimeout(releaseTimer.current);if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}setListening(false);setPhase('idle');}
 function finish(){const current=session.current;if(!current||phase==='processing')return;setPhase('processing');setMessage(ui.processing);clearTimeout(timer.current);try{current.stop();timer.current=setTimeout(()=>{if(session.current===current){stop();notify(text.error);}},5000);}catch{stop();notify(text.error);}}
 function notify(value){setMessage(value);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500);}
 useEffect(()=>{
  const cancel=()=>{if(document.hidden){stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');}};
  document.addEventListener('visibilitychange',cancel);
  return ()=>{document.removeEventListener('visibilitychange',cancel);clearTimeout(speechPulseTimer.current);clearTimeout(audioTimer.current);clearTimeout(releaseTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}clearTimeout(timer.current);clearTimeout(messageTimer.current);const current=session.current;session.current=null;if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
 },[]);
 function start(){
  if(session.current){finish();return;}
  clearTimeout(releaseTimer.current);stopSpeaking();setAnswer('');setAudioError('');setTranscript('');setActive(true);window.speechSynthesis?.getVoices();
  // Initialize Safari's speech channel inside the microphone tap, before the
  // asynchronous recognition result. Actual answers still wait for mic release.
  if(window.speechSynthesis&&window.SpeechSynthesisUtterance){try{const warmup=new window.SpeechSynthesisUtterance('');warmup.volume=0;window.speechSynthesis.speak(warmup);}catch{/* The visible replay action can retry with a fresh user gesture. */}}
  if(!Speech){notify(text.unsupported);return;}
  const recognition=new Speech();session.current=recognition;let finalText='';
  recognition.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];recognition.continuous=false;recognition.interimResults=true;recognition.maxAlternatives=3;
  clearTimeout(messageTimer.current);setListening(true);setPhase('starting');setMessage(ui.opening);
  recognition.onstart=()=>{if(session.current===recognition){setPhase('listening');setMessage(ui.listen);}};
  recognition.onspeechstart=()=>{if(session.current===recognition){clearTimeout(speechPulseTimer.current);setTalking(true);}};
  recognition.onspeechend=()=>{if(session.current===recognition){clearTimeout(speechPulseTimer.current);setTalking(false);}};
  recognition.onresult=event=>{
   if(session.current!==recognition)return;
   const result=event.results[event.resultIndex];setTranscript(result[0].transcript);
   clearTimeout(speechPulseTimer.current);setTalking(!result.isFinal);
   if(!result.isFinal){speechPulseTimer.current=setTimeout(()=>setTalking(false),900);return;}
   finalText=Array.from(result).map(item=>item.transcript).find(value=>parseCalendarVoiceCommand(value))||result[0].transcript;
   setPhase('processing');setMessage(ui.processing);recognition.stop();clearTimeout(timer.current);timer.current=setTimeout(()=>{if(session.current===recognition){stop();notify(text.error);}},5000);
  };
  recognition.onerror=event=>{if(session.current!==recognition)return;stop();notify(event.error==='not-allowed'||event.error==='service-not-allowed'?text.permission:text.error);};
  recognition.onend=()=>{if(session.current!==recognition)return;stop();const command=parseCalendarVoiceCommand(finalText);if(!command){notify(text.invalid);return;}setMessage('');const reply=onCommand(command);if(typeof reply==='string'&&reply){setAnswer(reply);releaseTimer.current=setTimeout(()=>speak(reply),180);}else setActive(false);};
  try{recognition.start();timer.current=setTimeout(()=>{if(session.current===recognition)finish();},20000);}catch{stop();notify(text.error);}
 }
 return <div className="calendar-voice-control" data-light={Boolean(isLight)} data-active={active}>
  <button type="button" className="calendar-voice-button" disabled={phase==='processing'} onClick={start} aria-pressed={listening} aria-label={listening?ui.done:text.start} title={text.start}><span className="calendar-voice-glyph" data-talking={talking&&phase==='listening'} aria-hidden="true"><span className="calendar-voice-equalizer"><i/><i/><i/></span>{phase==='processing'?<Square size={15}/>:<Mic size={18}/>}<span className="calendar-voice-equalizer"><i/><i/><i/></span></span> {active&&<span>{listening?(phase==='processing'?ui.processing:phase==='starting'?ui.opening:ui.done):speaking?({ru:'Отвечаю',en:'Speaking',ro:'Răspund'}[locale]):text.start}</span>}</button>
  {active&&<button type="button" className="calendar-voice-close" aria-label={ui.close} onClick={()=>{stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');}}><X size={18}/></button>}
  {answer&&<div className="calendar-voice-message calendar-voice-answer"><p role="status" aria-live="polite">{answer}</p>{audioError&&<p className="calendar-voice-audio-error" role="alert">{audioError}</p>}<div className="calendar-voice-answer-actions">{window.speechSynthesis&&window.SpeechSynthesisUtterance&&<button type="button" aria-label={speaking?audioText.stop:audioText.play} onClick={()=>speaking?stopSpeaking():speak(answer)}>{speaking?<Square size={16}/>:<Volume2 size={18}/>}<span>{speaking?audioText.stop:audioText.play}</span></button>}<button type="button" aria-label={audioText.close} onClick={()=>{clearTimeout(releaseTimer.current);stopSpeaking();setAnswer('');setActive(false);}}><X size={18}/></button></div></div>}
  {message&&<div className="calendar-voice-message"><p role="status" aria-live="polite">{message}</p>{listening&&<p>{ui.hint}</p>}{transcript&&<p className="calendar-voice-transcript">«{transcript}»</p>}{Speech&&<><p className="calendar-voice-help-title">{help.title}</p><ul className="calendar-voice-commands">{[...help.list,...financeHelp,...(locale==='ru'?['Войди в кошелёк','Включи режим про','Выключи режим про','Перемотай на следующий месяц','Перемотай назад','Добавь 60 лей, я сегодня потратил']:[]),...(traderMode?[help.trade]:[])].map(command=><li key={command}>«{command}»</li>)}</ul><p className="calendar-voice-help-note">{help.note}</p></>}</div>}
 </div>;
}
