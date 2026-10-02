import {spokenText} from '../lib/spokenText.js';
import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,X} from 'lucide-react';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import {voiceEntryReview,shortEntryAnswer,localDateKey} from '../lib/voiceEntryReview.js';
import {prepareVoiceCue,playVoiceCue} from '../lib/voiceReadyCue.js';
import VoiceEntryCard from './VoiceEntryCard.jsx';
import useVoiceFeedback from './useVoiceFeedback.js';
import {voiceHelp} from '../lib/voiceHelp.js';
import {voicesForLocale,selectPlaybackVoice} from '../lib/voicePlayback.js';
import './CalendarVoiceButton.css';

export default function CalendarVoiceButton({language='ru',isLight,traderMode=false,categoryOptions=[],defaultCurrency,askDestination=false,walletAvailable=false,onCommand,onSaveEntry}){
 const locale=String(language).startsWith('zh')?'zh':language==='en'?'en':language==='ro'||language==='md'?'ro':'ru';
 const text={
  zh: {start:"语音命令",stop:"停止麦克风",hint:"“添加记录”或“打开2048年11月13日”",invalid:"请尝试说“添加记录”或“打开2048年11月13日”。",permission:"请允许浏览器使用麦克风。",error:"语音输入不可用，请重试。",unsupported:"此浏览器不支持语音命令。"},ru:{start:'Голосовая команда',stop:'Остановить микрофон',hint:'«Добавь запись» или «открой 13 ноября 2048»',invalid:'Не понял эту фразу. Попробуйте сказать иначе или выбрать пример ниже.',permission:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Попробуйте ещё раз.',unsupported:'Браузер не поддерживает голосовые команды.'},en:{start:'Voice command',stop:'Stop microphone',hint:'“Add entry” or “open 13 November 2048”',invalid:'Try “add entry” or “open 13 November 2048”.',permission:'Allow microphone access in your browser.',error:'Voice input unavailable. Try again.',unsupported:'Voice commands are not supported by this browser.'},ro:{start:'Comandă vocală',stop:'Oprește microfonul',hint:'„Adaugă o înregistrare” sau „deschide 13 noiembrie 2048”',invalid:'Încearcă „adaugă o înregistrare” sau „deschide 13 noiembrie 2048”.',permission:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Încearcă din nou.',unsupported:'Browserul nu acceptă comenzile vocale.'}}[locale];
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState(''),[speaking,setSpeaking]=useState(false);
 const [review,setReview]=useState(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[saveLocked,setSaveLocked]=useState(false);
 const saveBusy=useRef(false),saveProgress=useRef({}),cue=useRef(null),mounted=useRef(true);
 const [feedback,setFeedback]=useVoiceFeedback();
 const feedbackLabel={
  zh: "朗读回答",ru:'Озвучивать ответы',en:'Speak answers',ro:'Răspunsuri vocale'}[locale];
 const feedbackControl=<label className="calendar-voice-feedback"><input type="checkbox" checked={feedback} onChange={event=>setFeedback(event.target.checked)}/>{feedbackLabel}</label>;
 const [active,setActive]=useState(false),[phase,setPhase]=useState('idle'),[transcript,setTranscript]=useState(''),[audioError,setAudioError]=useState('');
 const audioTimer=useRef(null),releaseTimer=useRef(null);
 const [talking,setTalking]=useState(false),[questionField,setQuestionField]=useState(null),[selectedReply,setSelectedReply]=useState('');
 const speechPulseTimer=useRef(null);
 const phraseTimer=useRef(null);
 const [voices,setVoices]=useState(()=>window.speechSynthesis?.getVoices()||[]);
 const [preferredVoice,setPreferredVoice]=useState(()=>{try{return localStorage.getItem(`dayris_voice:${locale}`)||'';}catch{return '';}});
 const playbackLabels={
  zh: {voice:"语音",auto:"自动",missing:"此设备尚未安装中文语音。"},ru:{voice:'Голос',auto:'Автоматически',missing:'Русский голос не найден среди установленных на устройстве.'},en:{voice:'Voice',auto:'Automatic',missing:'No English voice is installed on this device.'},ro:{voice:'Voce',auto:'Automat',missing:'Nu există o voce română instalată pe dispozitiv.'}}[locale];
 useEffect(()=>{const synth=window.speechSynthesis;if(!synth)return;const update=()=>setVoices(synth.getVoices());update();synth.addEventListener?.('voiceschanged',update);return()=>synth.removeEventListener?.('voiceschanged',update);},[]);
 useEffect(()=>{try{setPreferredVoice(localStorage.getItem(`dayris_voice:${locale}`)||'');}catch{setPreferredVoice('');}},[locale]);
 const ui={
  zh: {opening:"正在启动麦克风…",listen:"正在聆听，请说话",processing:"正在处理…",done:"完成，发送语音",hint:"暂停说话后自动发送，也可点击“完成”。",audio:"声音未能播放，请点击“播放回答”。",close:"关闭语音模式"},ru:{opening:'Включаю микрофон…',listen:'Слушаю — говорите',processing:'Обрабатываю…',done:'Готово — обработать фразу',hint:'После паузы команда отправится сама. Или нажмите «Готово».',audio:'Звук не запустился. Нажмите «Прослушать ответ».',close:'Закрыть голосовой режим'},en:{opening:'Starting microphone…',listen:'Listening — speak now',processing:'Processing…',done:'Done — send phrase',hint:'Pause to send automatically, or tap Done.',audio:'Audio did not start. Tap Listen to answer.',close:'Close voice mode'},ro:{opening:'Pornesc microfonul…',listen:'Ascult — vorbește acum',processing:'Procesez…',done:'Gata — trimite fraza',hint:'Pauza trimite automat. Sau apasă Gata.',audio:'Sunetul nu a pornit. Apasă Ascultă răspunsul.',close:'Închide modul vocal'}}[locale];
 const utterance=useRef(null),entryDraft=useRef(null);
 const audioText={
  zh: {play:"播放回答",stop:"停止播放回答",close:"关闭回答"},ru:{play:'Прослушать ответ',stop:'Остановить ответ',close:'Закрыть ответ'},en:{play:'Listen to answer',stop:'Stop answer',close:'Close answer'},ro:{play:'Ascultă răspunsul',stop:'Oprește răspunsul',close:'Închide răspunsul'}}[locale];
 function stopSpeaking(){clearTimeout(audioTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}setSpeaking(false);}
 function speak(value,after){
  stopSpeaking();setAudioError('');if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);return;}
  const speech=new window.SpeechSynthesisUtterance(spokenText(value,locale));utterance.current=speech;
  speech.lang={
  zh: "zh-CN",ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];speech.rate=1;speech.pitch=1;speech.volume=1;
  const available=window.speechSynthesis.getVoices();setVoices(available);const voice=selectPlaybackVoice(available,locale,preferredVoice,navigator.onLine!==false);if(!voice){utterance.current=null;setAudioError(playbackLabels.missing);if(after)releaseTimer.current=setTimeout(after,250);return;}speech.voice=voice;
  const finish=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);utterance.current=null;setSpeaking(false);}};
  speech.onstart=()=>{if(utterance.current===speech){clearTimeout(audioTimer.current);setSpeaking(true);}};
  speech.onend=()=>{finish();if(after)releaseTimer.current=setTimeout(after,250);};speech.onerror=()=>{finish();setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);};
  audioTimer.current=setTimeout(()=>{if(utterance.current===speech){stopSpeaking();setAudioError(ui.audio);if(after)releaseTimer.current=setTimeout(after,250);}},3500);
  try{if(window.speechSynthesis.paused)window.speechSynthesis.resume();window.speechSynthesis.speak(speech);}catch{speech.onerror();}
 }
 function respond(value,after){if(feedback&&!document.hidden&&mounted.current)speak(value,after);}
 useEffect(()=>{if(!feedback){clearTimeout(releaseTimer.current);stopSpeaking();}},[feedback]);
 const compactHelp=voiceHelp(locale,traderMode);
 const localeVoices=voicesForLocale(voices,locale);
 const voicePicker=<label className="calendar-voice-picker"><span>{playbackLabels.voice}</span><select aria-label={playbackLabels.voice} value={localeVoices.some(voice=>voice.voiceURI===preferredVoice)?preferredVoice:''} onChange={event=>{stopSpeaking();setPreferredVoice(event.target.value);try{localStorage.setItem(`dayris_voice:${locale}`,event.target.value);}catch{/* Session preference still works. */}}}><option value="">{playbackLabels.auto}</option>{localeVoices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}</select></label>;
 const session=useRef(null),timer=useRef(null),messageTimer=useRef(null);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stop(){const current=session.current;session.current=null;clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);setTalking(false);clearTimeout(timer.current);clearTimeout(releaseTimer.current);if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}setListening(false);setPhase('idle');}
 function finish(){const current=session.current;if(!current||phase==='processing')return;clearTimeout(phraseTimer.current);setPhase('processing');setMessage(ui.processing);clearTimeout(timer.current);try{current.stop();timer.current=setTimeout(()=>{if(session.current===current){stop();notify(text.error);}},5000);}catch{stop();notify(text.error);}}
 function notify(value){if(review)setSaveError(value);setMessage(value);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500);}
 useEffect(()=>{
  mounted.current=true;
  const cancel=()=>{if(document.hidden){stop();stopSpeaking();setMessage('');}};
  document.addEventListener('visibilitychange',cancel);
  return ()=>{mounted.current=false;cue.current?.close().catch(()=>{});cue.current=null;document.removeEventListener('visibilitychange',cancel);clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);clearTimeout(audioTimer.current);clearTimeout(releaseTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}clearTimeout(timer.current);clearTimeout(messageTimer.current);const current=session.current;session.current=null;if(current){current.onspeechstart=null;current.onspeechend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
 },[]);
 useEffect(()=>{if(saveBusy.current||saveProgress.current.wallet||saveProgress.current.calendar)return;entryDraft.current=null;setReview(null);setQuestionField(null);stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');clearTimeout(messageTimer.current);},[locale]);
 function cancelDraft(){if(saveBusy.current)return;entryDraft.current=null;setReview(null);setQuestionField(null);setSaveError('');setSaveLocked(false);saveProgress.current={};stop();stopSpeaking();setActive(false);setAnswer('');setMessage('');}
 function changeReview(entry){if(saveBusy.current||saveLocked)return;entryDraft.current=entry;setReview(entry);setSaveError('');}
 async function saveEntry(){
  if(saveBusy.current||!entryDraft.current||!review)return;
  const entry={...entryDraft.current};saveBusy.current=true;setSaving(true);setSaveError('');stop();stopSpeaking();
  try{
   if(onSaveEntry)await onSaveEntry(entry,saveProgress.current);
   else await onCommand(entry);
   if(!mounted.current)return;
   entryDraft.current=null;setReview(null);setQuestionField(null);saveProgress.current={};setSaveLocked(false);setActive(true);
   const reply=shortEntryAnswer(entry,locale);setAnswer(reply);setMessage('');respond(reply);
  }catch(error){if(mounted.current){setSaveError(error.message||text.error);setSaveLocked(Boolean(saveProgress.current.wallet||saveProgress.current.calendar));}}
  finally{saveBusy.current=false;if(mounted.current)setSaving(false);}
 }
 function handlePhrase(phrase){
  if(saveBusy.current||saveLocked)return;
  // Only an explicit save command submits a reviewed draft.
  if(review&&/^(?:сохрани|сохранить|да сохрани|保存|确认保存|save|save it|salvează|salveaza)$/i.test(phrase.trim())){saveEntry();return;}
  const dialog=voiceEntryReview(phrase,entryDraft.current,locale,categoryOptions,{defaultCurrency,askDestination,walletAvailable});
  if(dialog?.cancelled){cancelDraft();return;}
  if(dialog?.invalid){setSaveError(text.invalid);setAudioError(text.invalid);return;}
  if(dialog?.entry){entryDraft.current=dialog.entry;setReview(dialog.entry);setQuestionField(null);setAnswer('');setMessage('');setAudioError('');setSaveError('');setActive(true);return;}
  if(dialog?.draft){entryDraft.current=dialog.draft;setReview(null);setQuestionField(dialog.field);setSelectedReply('');setMessage('');setAnswer(dialog.prompt);releaseTimer.current=setTimeout(()=>respond(dialog.prompt,()=>start(true)),180);return;}
  if(entryDraft.current){setSaveError(text.invalid);setAudioError(text.invalid);return;}
  const command=parseCalendarVoiceCommand(phrase);
  if(!command){notify(text.invalid);return;}
  setQuestionField(null);setMessage('');setAnswer('');setAudioError('');let reply;
  try{reply=onCommand(command);}catch(error){console.error('DAYRIS voice action failed',error);setActive(true);notify(text.error);return;}
  if(typeof reply==='string'&&reply){setAnswer(reply);releaseTimer.current=setTimeout(()=>respond(reply),180);}else setActive(false);
 }
 function submitReply(){if(!selectedReply.trim())return;stop();stopSpeaking();handlePhrase(selectedReply);}
 function start(automatic=false){
  if(saveBusy.current||saveLocked)return;
  if(session.current){finish();return;}
  clearTimeout(releaseTimer.current);stopSpeaking();if(automatic!==true&&!entryDraft.current)setAnswer('');setAudioError('');setTranscript('');setActive(true);window.speechSynthesis?.getVoices();
  if(automatic!==true){if(!cue.current)cue.current=prepareVoiceCue();else cue.current.resume().catch(()=>{});}
  // Initialize Safari's speech channel inside the microphone tap, before the
  // asynchronous recognition result. Actual answers still wait for mic release.
  if(feedback&&/iPad|iPhone|iPod/.test(navigator.userAgent)&&window.speechSynthesis&&window.SpeechSynthesisUtterance){try{const warmup=new window.SpeechSynthesisUtterance('');warmup.lang={
  zh: "zh-CN",ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];warmup.volume=0;window.speechSynthesis.speak(warmup);}catch{/* The visible replay action can retry with a fresh user gesture. */}}
  if(!Speech){notify(text.unsupported);return;}
  const recognition=new Speech();session.current=recognition;let finalText='',latestText='';
  recognition.lang={
  zh: "zh-CN",ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  clearTimeout(messageTimer.current);setListening(true);setPhase('starting');setMessage(ui.opening);
  recognition.onstart=()=>{if(session.current===recognition){setPhase('listening');setMessage(ui.listen);playVoiceCue(cue.current);}};
  recognition.onspeechstart=()=>{if(session.current===recognition){clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);setTalking(true);}};
  recognition.onspeechend=()=>{if(session.current===recognition){clearTimeout(speechPulseTimer.current);setTalking(false);}};
  recognition.onresult=event=>{
   if(session.current!==recognition)return;
   const results=Array.from(event.results);
   const finalResults=results.filter(result=>result.isFinal);
   finalText=finalResults.map(result=>result[0].transcript).join(' ').trim();
   // A single-result recognizer can offer a better alternative for the whole phrase.
   if(finalResults.length===1&&!entryDraft.current)finalText=Array.from(finalResults[0]).map(item=>item.transcript).find(value=>{const command=voiceEntryReview(value,null,locale,categoryOptions,{walletAvailable})?.entry||parseCalendarVoiceCommand(value);return command&&command.type!=='category-prompt';})||finalText;
   latestText=results.map(result=>result[0].transcript).join(' ').trim();setTranscript(latestText);
   clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);
   const interim=results.some(result=>!result.isFinal);if(!interim)latestText=finalText;setTalking(interim);
   if(interim){speechPulseTimer.current=setTimeout(()=>setTalking(false),900);phraseTimer.current=setTimeout(()=>{if(session.current===recognition)finish();},2200);return;}
   const command=voiceEntryReview(finalText,entryDraft.current,locale,categoryOptions,{defaultCurrency,walletAvailable})?.entry||parseCalendarVoiceCommand(finalText);
   // Keep a brief pause available for the category or remaining words.
   phraseTimer.current=setTimeout(()=>{if(session.current===recognition)finish();},command&&command.type!=='category-prompt'?1400:2600);
  };
  recognition.onerror=event=>{if(session.current!==recognition)return;stop();notify(event.error==='not-allowed'||event.error==='service-not-allowed'?text.permission:event.error==='language-not-supported'?({
  zh: "设备不支持此语言识别，请检查 Google 语音输入语言。",ru:'Распознавание русского языка недоступно на устройстве. Проверьте языки голосового ввода Google.',en:'English recognition is unavailable. Check Google voice input languages.',ro:'Recunoașterea limbii române nu este disponibilă. Verifică limbile introducerii vocale Google.'}[locale]):text.error);};
  recognition.onend=()=>{if(session.current!==recognition)return;stop();const phrase=latestText||finalText;if(!phrase&&entryDraft.current){setAudioError({
  zh: "未听到回答，请点击麦克风继续。",ru:'Не услышал ответ. Нажмите микрофон, чтобы продолжить.',en:'No answer heard. Tap the microphone to continue.',ro:'Nu am auzit răspunsul. Apasă microfonul pentru a continua.'}[locale]);return;}handlePhrase(phrase);};
  try{recognition.start();timer.current=setTimeout(()=>{if(session.current===recognition)finish();},20000);}catch{stop();notify(text.error);}
 }
 return <div className="calendar-voice-control" data-light={Boolean(isLight)} data-active={active} data-phase={speaking?'speaking':phase}>
  <button type="button" className="calendar-voice-button" disabled={phase==='processing'||saving||saveLocked} onClick={start} aria-pressed={listening} aria-label={listening?ui.done:text.start} title={text.start}><span className="calendar-voice-glyph" data-talking={talking&&phase==='listening'} aria-hidden="true"><span className="calendar-voice-equalizer"><i/><i/><i/></span>{phase==='processing'?<Square size={15}/>:<Mic size={18}/>}<span className="calendar-voice-equalizer"><i/><i/><i/></span></span> {active&&<span>{listening?(phase==='processing'?ui.processing:phase==='starting'?ui.opening:ui.done):speaking?({
  zh: "正在播放",ru:'Отвечаю',en:'Speaking',ro:'Răspund'}[locale]):text.start}</span>}</button>
  {active&&<button type="button" className="calendar-voice-close" aria-label={ui.close} disabled={saving} onClick={cancelDraft}><X size={18}/></button>}
  {review&&<VoiceEntryCard entry={review} locale={locale} categories={categoryOptions} walletAvailable={walletAvailable} onChange={changeReview} onSave={saveEntry} onCancel={cancelDraft} busy={saving} listening={listening} error={saveError} locked={saveLocked}>{feedbackControl}</VoiceEntryCard>}
  {review&&listening&&<div className="calendar-voice-live" role="status" aria-live="polite">{phase==='starting'?ui.opening:phase==='processing'?ui.processing:ui.listen}{transcript&&<span>«{transcript}»</span>}</div>}
  {answer&&!review&&<div className="calendar-voice-message calendar-voice-answer"><p role="status" aria-live="polite">{answer}</p>{feedbackControl}{listening&&entryDraft.current&&<p>{ui.listen}{transcript&&` · ${transcript}`}</p>}{audioError&&<p className="calendar-voice-audio-error" role="alert">{audioError}</p>}{!questionField&&(localeVoices.length>0?voicePicker:voices.length>0&&<p className="calendar-voice-help-note">{playbackLabels.missing}</p>)}{questionField&&<div className="calendar-voice-replies">{questionField==='category'?<div className="calendar-voice-category-reply"><select aria-label={locale === 'zh' ? "类别" : (locale==='ru'?'Категория':locale==='en'?'Category':'Categorie')} value={selectedReply} onChange={event=>setSelectedReply(event.target.value)}><option value="">{locale === 'zh' ? "选择类别" : (locale==='ru'?'Выберите категорию':locale==='en'?'Choose category':'Alege categoria')}</option>{categoryOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>{entryDraft.current?.item&&<button type="button" aria-pressed={selectedReply.startsWith('создай категорию ')} onClick={()=>setSelectedReply((locale==='zh'?'创建类别':'создай категорию ')+entryDraft.current.item)}>{locale === 'zh' ? "创建" : (locale==='ru'?'Создать':locale==='en'?'Create':'Creează')} «{entryDraft.current?.item}»</button>}</div>:questionField==='date'?<input aria-label={locale === 'zh' ? "日期" : (locale==='ru'?'Дата':locale==='en'?'Date':'Data')} type="date" max={localDateKey()} value={selectedReply} onChange={event=>setSelectedReply(event.target.value)}/>:questionField==='amount'?<input aria-label={locale === 'zh' ? "金额" : (locale==='ru'?'Сумма':locale==='en'?'Amount':'Sumă')} inputMode="decimal" value={selectedReply} onChange={event=>setSelectedReply(event.target.value)} placeholder="0"/>:<div className="calendar-voice-options">{(questionField==='destination'?(locale==='zh'?[['日历','日历'],...(walletAvailable?[['钱包','钱包'],['两者','两者']]:[])]:locale==='ru'?[['календарь','Календарь'],...(walletAvailable?[['кошелек','Кошелёк'],['оба','В оба']]:[])]:locale==='en'?[['calendar','Calendar'],...(walletAvailable?[['wallet','Wallet'],['both','Both']]:[])]:[['calendar','Calendar'],...(walletAvailable?[['wallet','Portofel'],['both','Ambele']]:[])]):questionField==='currency'?[...(defaultCurrency?[[locale==='zh'?'是':'да',locale === 'zh' ? "是" : (locale==='ru'?'Да':locale==='en'?'Yes':'Da')]]:[]),['RUB','₽ RUB'],['EUR','€ EUR'],['MDL','L MDL'],['USD','$ USD'],['CNY','¥ CNY']]:locale==='zh'?[['支出','支出'],['收入','收入']]:locale==='ru'?[['расход','Расход'],['доход','Доход']]:locale==='en'?[['expense','Expense'],['income','Income']]:[['cheltuiala','Cheltuială'],['venit','Venit']]).map(([value,label])=><button key={value} type="button" aria-pressed={selectedReply===value} onClick={()=>setSelectedReply(value)}>{label}</button>)}</div>}<div className="calendar-voice-reply-actions"><button type="button" disabled={!selectedReply.trim()} onClick={submitReply}>{locale === 'zh' ? "发送" : (locale==='ru'?'Отправить':locale==='en'?'Send':'Trimite')}</button><button type="button" onClick={()=>{stop();start(true);}}><Mic size={16}/>{locale === 'zh' ? "语音回答" : (locale==='ru'?'Ответить голосом':locale==='en'?'Reply by voice':'Răspunde vocal')}</button></div></div>}<div className="calendar-voice-answer-actions">{window.speechSynthesis&&window.SpeechSynthesisUtterance&&<button type="button" aria-label={speaking?audioText.stop:audioText.play} onClick={()=>speaking?stopSpeaking():speak(answer,entryDraft.current?()=>start(true):undefined)}>{speaking?<Square size={16}/>:<Volume2 size={18}/>}<span>{speaking?audioText.stop:audioText.play}</span></button>}<button type="button" aria-label={audioText.close} onClick={cancelDraft}><X size={18}/></button></div></div>}
  {message&&!answer&&!review&&<div className="calendar-voice-message"><div className="calendar-assistant-heading"><Mic size={14}/><span>DAYRIS</span><small>{locale === 'zh' ? "助手" : (locale==='ru'?'Помощник':locale==='en'?'Assistant':'Asistent')}</small></div><div className="calendar-voice-shortcuts">{(locale === 'zh' ? ["打开历史","打开设置","本月"] : (locale==='ru'?['Открыть историю','Открыть настройки','К сегодняшнему месяцу']:locale==='en'?['Open history','Open settings','Current month']:['Deschide istoricul','Deschide setări','Luna curentă'])).map((label,index)=><button type="button" key={label} onClick={()=>{stop();stopSpeaking();entryDraft.current=null;setQuestionField(null);handlePhrase(['открой историю','открой настройки','открой текущий месяц'][index]);}}>{label}</button>)}</div><p role="status" aria-live="polite">{message}</p>{feedbackControl}{listening&&<p>{ui.hint}</p>}{transcript&&<p className="calendar-voice-transcript">«{transcript}»</p>}{Speech&&<><p className="calendar-voice-help-title">{compactHelp.title}</p><div className="calendar-voice-help-groups">{compactHelp.groups.map(group=><details key={group.title}><summary><span>{group.title}</span><small>{group.hint}</small></summary><ul className="calendar-voice-commands">{group.phrases.map(phrase=><li key={phrase}>{phrase}</li>)}</ul></details>)}</div><p className="calendar-voice-help-note">{compactHelp.note}</p></>}</div>}
 </div>;
}
