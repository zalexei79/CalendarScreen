import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,X} from 'lucide-react';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import {voiceEntryDialog} from '../lib/voiceEntryDialog.js';
import {voiceHelp} from '../lib/voiceHelp.js';
import {voicesForLocale,selectPlaybackVoice} from '../lib/voicePlayback.js';
import './CalendarVoiceButton.css';

export default function CalendarVoiceButton({language='ru',isLight,traderMode=false,onCommand}){
 const locale=language==='en'?'en':language==='ro'||language==='md'?'ro':'ru';
 const text={ru:{start:'Голосовая команда',stop:'Остановить микрофон',hint:'«Добавь запись» или «открой 13 ноября 2048»',invalid:'Не понял эту фразу. Попробуйте сказать иначе или выбрать пример ниже.',permission:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Попробуйте ещё раз.',unsupported:'Браузер не поддерживает голосовые команды.'},en:{start:'Voice command',stop:'Stop microphone',hint:'“Add entry” or “open 13 November 2048”',invalid:'Try “add entry” or “open 13 November 2048”.',permission:'Allow microphone access in your browser.',error:'Voice input unavailable. Try again.',unsupported:'Voice commands are not supported by this browser.'},ro:{start:'Comandă vocală',stop:'Oprește microfonul',hint:'„Adaugă o înregistrare” sau „deschide 13 noiembrie 2048”',invalid:'Încearcă „adaugă o înregistrare” sau „deschide 13 noiembrie 2048”.',permission:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Încearcă din nou.',unsupported:'Browserul nu acceptă comenzile vocale.'}}[locale];
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState(''),[speaking,setSpeaking]=useState(false);
 const [active,setActive]=useState(false),[phase,setPhase]=useState('idle'),[transcript,setTranscript]=useState(''),[audioError,setAudioError]=useState('');
 const audioTimer=useRef(null),releaseTimer=useRef(null);
 const [talking,setTalking]=useState(false),[questionField,setQuestionField]=useState(null),[selectedReply,setSelectedReply]=useState('');
 const speechPulseTimer=useRef(null);
 const phraseTimer=useRef(null);
 const [voices,setVoices]=useState(()=>window.speechSynthesis?.getVoices()||[]);
 const [preferredVoice,setPreferredVoice]=useState(()=>{try{return localStorage.getItem(`dayris_voice:${locale}`)||'';}catch{return '';}});
 const playbackLabels={ru:{voice:'Голос',auto:'Автоматически',missing:'Русский голос не найден среди установленных на устройстве.'},en:{voice:'Voice',auto:'Automatic',missing:'No English voice is installed on this device.'},ro:{voice:'Voce',auto:'Automat',missing:'Nu există o voce română instalată pe dispozitiv.'}}[locale];
 useEffect(()=>{const synth=window.speechSynthesis;if(!synth)return;const update=()=>setVoices(synth.getVoices());update();synth.addEventListener?.('voiceschanged',update);return()=>synth.removeEventListener?.('voiceschanged',update);},[]);
 useEffect(()=>{try{setPreferredVoice(localStorage.getItem(`dayris_voice:${locale}`)||'');}catch{setPreferredVoice('');}},[locale]);
 const ui={ru:{opening:'Включаю микрофон…',listen:'Слушаю — говорите',processing:'Обрабатываю…',done:'Готово — обработать фразу',hint:'После паузы команда отправится сама. Или нажмите «Готово».',audio:'Звук не запустился. Нажмите «Прослушать ответ».',close:'Закрыть голосовой режим'},en:{opening:'Starting microphone…',listen:'Listening — speak now',processing:'Processing…',done:'Done — send phrase',hint:'Pause to send automatically, or tap Done.',audio:'Audio did not start. Tap Listen to answer.',close:'Close voice mode'},ro:{opening:'Pornesc microfonul…',listen:'Ascult — vorbește acum',processing:'Procesez…',done:'Gata — trimite fraza',hint:'Pauza trimite automat. Sau apasă Gata.',audio:'Sunetul nu a pornit. Apasă Ascultă răspunsul.',close:'Închide modul vocal'}}[locale];
 const utterance=useRef(null),entryDraft=useRef(null);
 const audioText={ru:{play:'Прослушать ответ',stop:'Остановить ответ',close:'Закрыть ответ'},en:{play:'Listen to answer',stop:'Stop answer',close:'Close answer'},ro:{play:'Ascultă răspunsul',stop:'Oprește răspunsul',close:'Închide răspunsul'}}[locale];
 function stopSpeaking(){clearTimeout(audioTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}setSpeaking(false);}
 function speak(value,after){
  stopSpeaking();setAudioError('');if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);return;}
  const speech=new window.SpeechSynthesisUtterance(value);utterance.current=speech;
  speech.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];speech.rate=1;speech.pitch=1;speech.volume=1;
  const available=window.speechSynthesis.getVoices();setVoices(available);const voice=selectPlaybackVoice(available,locale,preferredVoice,navigator.onLine!==false);if(!voice){utterance.current=null;setAudioError(playbackLabels.missing);if(after)releaseTimer.current=setTimeout(after,250);return;}speech.voice=voice;
  const finish=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);utterance.current=null;setSpeaking(false);}};
  speech.onstart=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);setSpeaking(true);}};
  speech.onend=()=>{finish();if(after)releaseTimer.current=setTimeout(after,250);};speech.onerror=()=>{finish();setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);};
  audioTimer.current=setTimeout(()=>{if(utterance.current===speech){stopSpeaking();setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);}},3500);
  try{if(window.speechSynthesis.paused)window.speechSynthesis.resume();window.speechSynthesis.speak(speech);}catch{speech.onerror();}
 }
 const compactHelp=voiceHelp(locale,traderMode);
 const localeVoices=voicesForLocale(voices,locale);
 const voicePicker=<label className="calendar-voice-picker"><span>{playbackLabels.voice}</span><select aria-label={playbackLabels.voice} value={localeVoices.some(voice=>voice.voiceURI===preferredVoice)?preferredVoice:''} onChange={event=>{stopSpeaking();setPreferredVoice(event.target.value);try{localStorage.setItem(`dayris_voice:${locale}`,event.target.value);}catch{/* Session preference still works. */}}}><option value="">{playbackLabels.auto}</option>{localeVoices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}</select></label>;
 const session=useRef(null),timer=useRef(null),messageTimer=useRef(null);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stop(){const current=session.current;session.current=null;clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);setTalking(false);clearTimeout(timer.current);clearTimeout(releaseTimer.current);if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}setListening(false);setPhase('idle');}
 function finish(){const current=session.current;if(!current||phase==='processing')return;clearTimeout(phraseTimer.current);setPhase('processing');setMessage(ui.processing);clearTimeout(timer.current);try{current.stop();timer.current=setTimeout(()=>{if(session.current===current){stop();notify(text.error);}},5000);}catch{stop();notify(text.error);}}
 function notify(value){setMessage(value);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500);}
 useEffect(()=>{
  const cancel=()=>{if(document.hidden){entryDraft.current=null;setQuestionField(null);stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');}};
  document.addEventListener('visibilitychange',cancel);
  return ()=>{document.removeEventListener('visibilitychange',cancel);clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);clearTimeout(audioTimer.current);clearTimeout(releaseTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}clearTimeout(timer.current);clearTimeout(messageTimer.current);const current=session.current;session.current=null;if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
 },[]);
 useEffect(()=>{entryDraft.current=null;setQuestionField(null);stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');clearTimeout(messageTimer.current);},[locale]);
 function handlePhrase(phrase){const dialog=voiceEntryDialog(phrase,entryDraft.current,locale);if(dialog?.cancelled){entryDraft.current=null;setQuestionField(null);setActive(false);setAnswer('');setMessage('');return;}if(dialog?.draft){entryDraft.current=dialog.draft;setQuestionField(dialog.field);setSelectedReply('');setMessage('');setAnswer(dialog.prompt);releaseTimer.current=setTimeout(()=>speak(dialog.prompt,()=>start(true)),180);return;}const command=dialog?.command||parseCalendarVoiceCommand(phrase);if(command){entryDraft.current=null;setQuestionField(null);}if(!command){notify(text.invalid);return;}setMessage('');setAnswer('');setAudioError('');const reply=onCommand(command);if(typeof reply==='string'&&reply){setAnswer(reply);releaseTimer.current=setTimeout(()=>speak(reply),180);}else setActive(false);}
 function submitReply(){if(!selectedReply.trim())return;stop();stopSpeaking();handlePhrase(selectedReply);}
 function start(automatic=false){
  if(session.current){finish();return;}
  clearTimeout(releaseTimer.current);stopSpeaking();if(automatic!==true)setAnswer('');setAudioError('');setTranscript('');setActive(true);window.speechSynthesis?.getVoices();
  // Initialize Safari's speech channel inside the microphone tap, before the
  // asynchronous recognition result. Actual answers still wait for mic release.
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)&&window.speechSynthesis&&window.SpeechSynthesisUtterance){try{const warmup=new window.SpeechSynthesisUtterance('');warmup.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];warmup.volume=0;window.speechSynthesis.speak(warmup);}catch{/* The visible replay action can retry with a fresh user gesture. */}}
  if(!Speech){notify(text.unsupported);return;}
  const recognition=new Speech();session.current=recognition;let finalText='',latestText='';
  recognition.lang={ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  clearTimeout(messageTimer.current);setListening(true);setPhase('starting');setMessage(ui.opening);
  recognition.onstart=()=>{if(session.current===recognition){setPhase('listening');setMessage(ui.listen);}};
  recognition.onspeechstart=()=>{if(session.current===recognition){clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);setTalking(true);}};
  recognition.onspeechend=()=>{if(session.current===recognition){clearTimeout(speechPulseTimer.current);setTalking(false);}};
  recognition.onresult=event=>{
   if(session.current!==recognition)return;
   const results=Array.from(event.results);
   const finalResults=results.filter(result=>result.isFinal);
   finalText=finalResults.map(result=>result[0].transcript).join(' ').trim();
   // A single-result recognizer can offer a better alternative for the whole phrase.
   if(finalResults.length===1)finalText=Array.from(finalResults[0]).map(item=>item.transcript).find(value=>{const command=parseCalendarVoiceCommand(value);return command&&command.type!=='category-prompt';})||finalText;
   latestText=results.map(result=>result[0].transcript).join(' ').trim();setTranscript(latestText);
   clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);
   const interim=results.some(result=>!result.isFinal);setTalking(interim);
   if(interim){speechPulseTimer.current=setTimeout(()=>setTalking(false),900);return;}
   const command=parseCalendarVoiceCommand(finalText);
   // Keep a brief pause available for the category or remaining words.
   phraseTimer.current=setTimeout(()=>{if(session.current===recognition)finish();},command&&command.type!=='category-prompt'?1400:2600);
  };
  recognition.onerror=event=>{if(session.current!==recognition)return;stop();notify(event.error==='not-allowed'||event.error==='service-not-allowed'?text.permission:event.error==='language-not-supported'?({ru:'Распознавание русского языка недоступно на устройстве. Проверьте языки голосового ввода Google.',en:'English recognition is unavailable. Check Google voice input languages.',ro:'Recunoașterea limbii române nu este disponibilă. Verifică limbile introducerii vocale Google.'}[locale]):text.error);};
  recognition.onend=()=>{if(session.current!==recognition)return;stop();const phrase=finalText||latestText;if(!phrase&&entryDraft.current){setAudioError({ru:'Не услышал ответ. Нажмите микрофон, чтобы продолжить.',en:'No answer heard. Tap the microphone to continue.',ro:'Nu am auzit răspunsul. Apasă microfonul pentru a continua.'}[locale]);return;}handlePhrase(phrase);};
  try{recognition.start();timer.current=setTimeout(()=>{if(session.current===recognition)finish();},20000);}catch{stop();notify(text.error);}
 }
 return <div className="calendar-voice-control" data-light={Boolean(isLight)} data-active={active}>
  <button type="button" className="calendar-voice-button" disabled={phase==='processing'} onClick={start} aria-pressed={listening} aria-label={listening?ui.done:text.start} title={text.start}><span className="calendar-voice-glyph" data-talking={talking&&phase==='listening'} aria-hidden="true"><span className="calendar-voice-equalizer"><i/><i/><i/></span>{phase==='processing'?<Square size={15}/>:<Mic size={18}/>}<span className="calendar-voice-equalizer"><i/><i/><i/></span></span> {active&&<span>{listening?(phase==='processing'?ui.processing:phase==='starting'?ui.opening:ui.done):speaking?({ru:'Отвечаю',en:'Speaking',ro:'Răspund'}[locale]):text.start}</span>}</button>
  {active&&<button type="button" className="calendar-voice-close" aria-label={ui.close} onClick={()=>{entryDraft.current=null;setQuestionField(null);stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');}}><X size={18}/></button>}
  {answer&&<div className="calendar-voice-message calendar-voice-answer"><p role="status" aria-live="polite">{answer}</p>{listening&&entryDraft.current&&<p>{ui.listen}{transcript&&` · ${transcript}`}</p>}{audioError&&<p className="calendar-voice-audio-error" role="alert">{audioError}</p>}{!questionField&&(localeVoices.length>0?voicePicker:voices.length>0&&<p className="calendar-voice-help-note">{playbackLabels.missing}</p>)}{questionField&&<div className="calendar-voice-replies">{questionField==='amount'?<input aria-label={locale==='ru'?'Сумма':locale==='en'?'Amount':'Sumă'} inputMode="decimal" value={selectedReply} onChange={event=>setSelectedReply(event.target.value)} placeholder="0"/>:<div className="calendar-voice-options">{(questionField==='currency'?[['RUB','₽ RUB'],['EUR','€ EUR'],['MDL','L MDL'],['USD','$ USD']]:locale==='ru'?[['расход','Расход'],['доход','Доход']]:locale==='en'?[['expense','Expense'],['income','Income']]:[['cheltuiala','Cheltuială'],['venit','Venit']]).map(([value,label])=><button key={value} type="button" aria-pressed={selectedReply===value} onClick={()=>setSelectedReply(value)}>{label}</button>)}</div>}<div className="calendar-voice-reply-actions"><button type="button" disabled={!selectedReply.trim()} onClick={submitReply}>{locale==='ru'?'Отправить':locale==='en'?'Send':'Trimite'}</button><button type="button" onClick={()=>{stop();start(true);}}><Mic size={16}/>{locale==='ru'?'Ответить голосом':locale==='en'?'Reply by voice':'Răspunde vocal'}</button></div></div>}<div className="calendar-voice-answer-actions">{window.speechSynthesis&&window.SpeechSynthesisUtterance&&<button type="button" aria-label={speaking?audioText.stop:audioText.play} onClick={()=>speaking?stopSpeaking():speak(answer,entryDraft.current?()=>start(true):undefined)}>{speaking?<Square size={16}/>:<Volume2 size={18}/>}<span>{speaking?audioText.stop:audioText.play}</span></button>}<button type="button" aria-label={audioText.close} onClick={()=>{entryDraft.current=null;setQuestionField(null);stop();clearTimeout(releaseTimer.current);stopSpeaking();setAnswer('');setActive(false);}}><X size={18}/></button></div></div>}
  {message&&!answer&&<div className="calendar-voice-message"><p role="status" aria-live="polite">{message}</p>{listening&&<p>{ui.hint}</p>}{transcript&&<p className="calendar-voice-transcript">«{transcript}»</p>}{Speech&&<><p className="calendar-voice-help-title">{compactHelp.title}</p><div className="calendar-voice-help-groups">{compactHelp.groups.map(group=><details key={group.title}><summary><span>{group.title}</span><small>{group.hint}</small></summary><ul className="calendar-voice-commands">{group.phrases.map(phrase=><li key={phrase}>{phrase}</li>)}</ul></details>)}</div><p className="calendar-voice-help-note">{compactHelp.note}</p></>}</div>}
 </div>;
}
