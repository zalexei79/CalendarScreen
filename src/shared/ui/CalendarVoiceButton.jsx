import {spokenText} from '../lib/spokenText.js';
import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Volume2,X} from 'lucide-react';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import {voiceEntryReview,shortEntryAnswer,localDateKey} from '../lib/voiceEntryReview.js';
import {prepareVoiceCue,playVoiceCue} from '../lib/voiceReadyCue.js';
import VoiceEntryCard from './VoiceEntryCard.jsx';
import VoiceBatchCard from './VoiceBatchCard.jsx';
import {voiceEntryBatch,selectVoiceBatchEntry,saveVoiceBatch,voiceBatchHasProgress} from '../lib/voiceEntryBatch.js';
import useVoiceFeedback from './useVoiceFeedback.js';
import {voiceSuggestions} from '../lib/voiceSuggestions.js';
import VoiceSuggestions from './VoiceSuggestions.jsx';
import VoiceReplyControls from './VoiceReplyControls.jsx';
import {voicesForLocale,selectPlaybackVoice} from '../lib/voicePlayback.js';
import './CalendarVoiceButton.css';
import VoiceWorkspace from './VoiceWorkspace.jsx';
import {prepareConversationEntry,parseVoiceConversation} from '../lib/voiceConversation.js';
import {isVoiceHelpRequest,voiceCapabilities} from '../lib/voiceCapabilities.js';
import VoiceCapabilities from './VoiceCapabilities.jsx';
import {followupVoiceEntry} from '../lib/voiceQuickEntry.js';

export default function CalendarVoiceButton({onResetConversation,onConversation,selectedDate,onCreateCategory,onDeleteCategory,userId,language='ru',isLight,traderMode=false,categoryOptions=[],defaultCurrency,askDestination=false,walletAvailable=false,onCommand,onSaveEntry}){
 const locale=String(language).startsWith('zh')?'zh':language==='en'?'en':language==='ro'||language==='md'?'ro':'ru';
 const interactionCopy={ru:{correct:'Можно исправить голосом',next:'Можно сказать дальше',saving:'Сохраняю…',amountUpdated:'Сумма исправлена.',entry:['Потратил на сок','Нет, 350','Это доход'],mutation:['Нет, 350'],batch:['Во второй записи сумма 100'],after:['Ещё 50 на кофе','Отмени это','Что записал сегодня?']},en:{correct:'Correct by voice',next:'You can continue',saving:'Saving…',amountUpdated:'Amount updated.',entry:['Spent on juice','No, 350','Income'],mutation:['No, 350'],batch:['In second entry amount 100'],after:['Open history','Spent 20 USD on groceries']},ro:{correct:'Corectează vocal',next:'Poți continua',saving:'Salvez…',amountUpdated:'Suma corectată.',entry:['Cheltuit pe suc','Nu, 350','Venit'],mutation:['Nu, 350'],batch:['Nu, 100'],after:['Deschide istoricul']},zh:{correct:'可以语音修改',next:'可以继续说',saving:'正在保存…',amountUpdated:'金额已修改。',entry:['用于果汁','不，350','收入'],mutation:['不，350'],batch:['不，100'],after:['打开历史']}}[locale];
 const text={
  zh: {start:"语音命令",stop:"停止麦克风",hint:"“添加记录”或“打开2048年11月13日”",invalid:"请尝试说“添加记录”或“打开2048年11月13日”。",permission:"请允许浏览器使用麦克风。",error:"语音输入不可用，请重试。",unsupported:"此浏览器不支持语音命令。"},ru:{start:'Голосовая команда',stop:'Остановить микрофон',hint:'«Добавь запись» или «открой 13 ноября 2048»',invalid:'Не понял эту фразу. Попробуйте сказать иначе или выбрать пример ниже.',permission:'Разрешите доступ к микрофону в браузере.',error:'Голосовой ввод недоступен. Попробуйте ещё раз.',unsupported:'Браузер не поддерживает голосовые команды.'},en:{start:'Voice command',stop:'Stop microphone',hint:'“Add entry” or “open 13 November 2048”',invalid:'Try “add entry” or “open 13 November 2048”.',permission:'Allow microphone access in your browser.',error:'Voice input unavailable. Try again.',unsupported:'Voice commands are not supported by this browser.'},ro:{start:'Comandă vocală',stop:'Oprește microfonul',hint:'„Adaugă o înregistrare” sau „deschide 13 noiembrie 2048”',invalid:'Încearcă „adaugă o înregistrare” sau „deschide 13 noiembrie 2048”.',permission:'Permite accesul la microfon în browser.',error:'Introducerea vocală nu este disponibilă. Încearcă din nou.',unsupported:'Browserul nu acceptă comenzile vocale.'}}[locale];
 const [listening,setListening]=useState(false),[message,setMessage]=useState('');
 const [answer,setAnswer]=useState(''),[speaking,setSpeaking]=useState(false);
 const [answerAction,setAnswerAction]=useState(null);
 const [heard,setHeard]=useState(''),[nextHelp,setNextHelp]=useState(null),[choices,setChoices]=useState([]),[contextLabel,setContextLabel]=useState(''),[compact,setCompact]=useState(false),[showCapabilities,setShowCapabilities]=useState(false);
 const conversationContext=useRef(null),pendingPhrase=useRef(''),requestGeneration=useRef(0),handlers=useRef(null);
 handlers.current={onCommand,onConversation,onSaveEntry,onResetConversation,selectedDate,userId};
 const lifecycle=useRef(null);lifecycle.current={start,finish,handlePhrase:processPhrase,saveEntry};
 const [review,setReview]=useState(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[saveLocked,setSaveLocked]=useState(false);
 const saveBusy=useRef(false),saveProgress=useRef({}),cue=useRef(null),mounted=useRef(true);
 const [batch,setBatch]=useState(null),batchDraft=useRef(null);
 const [feedback,setFeedback]=useVoiceFeedback();
 const feedbackLabel={
  zh: "朗读回答",ru:'Озвучивать ответы',en:'Speak answers',ro:'Răspunsuri vocale'}[locale];
 const feedbackControl=<label className="calendar-voice-feedback"><input type="checkbox" checked={feedback} onChange={event=>setFeedback(event.target.checked)}/>{feedbackLabel}</label>;
 const [active,setActive]=useState(false),[phase,setPhase]=useState('idle'),[transcript,setTranscript]=useState(''),[audioError,setAudioError]=useState('');
 const audioTimer=useRef(null),releaseTimer=useRef(null);
 const [talking,setTalking]=useState(false),[questionField,setQuestionField]=useState(null);
 const speechPulseTimer=useRef(null),startupTimer=useRef(null),silenceTimer=useRef(null);
 const [recognitionHint,setRecognitionHint]=useState('');
 const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const noSpeech={ru:'Не услышал фразу. Нажмите микрофон и повторите.',en:'No words heard. Tap the microphone and try again.',ro:'Nu am auzit fraza. Apasă microfonul și repetă.',zh:'没有听到语音，请点击麦克风重试。'}[locale];
 const phraseTimer=useRef(null);
 const [voices,setVoices]=useState(()=>window.speechSynthesis?.getVoices()||[]);
 const [preferredVoice,setPreferredVoice]=useState(()=>{try{return localStorage.getItem(`dayris_voice:${locale}`)||'';}catch{return '';}});
 const playbackLabels={
  zh: {voice:"语音",auto:"自动",missing:"此设备尚未安装中文语音。"},ru:{voice:'Голос',auto:'Автоматически',missing:'Русский голос не найден среди установленных на устройстве.'},en:{voice:'Voice',auto:'Automatic',missing:'No English voice is installed on this device.'},ro:{voice:'Voce',auto:'Automat',missing:'Nu există o voce română instalată pe dispozitiv.'}}[locale];
 useEffect(()=>{const synth=window.speechSynthesis;if(!synth)return;const update=()=>setVoices(synth.getVoices());update();synth.addEventListener?.('voiceschanged',update);return()=>synth.removeEventListener?.('voiceschanged',update);},[]);
 useEffect(()=>{try{setPreferredVoice(localStorage.getItem(`dayris_voice:${locale}`)||'');}catch{setPreferredVoice('');}},[locale]);
 const ui={
  zh: {opening:"正在启动麦克风…",listen:"正在聆听，请说话",processing:"正在处理…",done:"完成，发送语音",hint:"暂停说话后自动发送，也可点击“完成”。",audio:"声音未能播放，请点击“播放回答”。",close:"关闭语音模式"},ru:{opening:'Включаю микрофон…',listen:'Слушаю — говорите',processing:'Обрабатываю…',done:'Готово — обработать фразу',hint:'После паузы команда отправится сама. Или нажмите «Готово».',audio:'Звук не запустился. Нажмите «Прослушать ответ».',close:'Закрыть голосовой режим'},en:{opening:'Starting microphone…',listen:'Listening — speak now',processing:'Processing…',done:'Done — send phrase',hint:'Pause to send automatically, or tap Done.',audio:'Audio did not start. Tap Listen to answer.',close:'Close voice mode'},ro:{opening:'Pornesc microfonul…',listen:'Ascult — vorbește acum',processing:'Procesez…',done:'Gata — trimite fraza',hint:'Pauza trimite automat. Sau apasă Gata.',audio:'Sunetul nu a pornit. Apasă Ascultă răspunsul.',close:'Închide modul vocal'}}[locale];
 const utterance=useRef(null),entryDraft=useRef(null),lastSavedEntry=useRef(null);
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
 function respond(value,after){if(feedback&&!document.hidden&&mounted.current)speak(value,after);else if(after&&mounted.current)releaseTimer.current=setTimeout(after,160);}
 useEffect(()=>{if(!feedback){clearTimeout(releaseTimer.current);stopSpeaking();}},[feedback]);
 const compactHelp=voiceSuggestions(locale,traderMode,{phrase:transcript,draft:entryDraft.current,review:Boolean(review),categories:categoryOptions,walletAvailable});
 const localeVoices=voicesForLocale(voices,locale);
 const voicePicker=<label className="calendar-voice-picker"><span>{playbackLabels.voice}</span><select aria-label={playbackLabels.voice} value={localeVoices.some(voice=>voice.voiceURI===preferredVoice)?preferredVoice:''} onChange={event=>{stopSpeaking();setPreferredVoice(event.target.value);try{localStorage.setItem(`dayris_voice:${locale}`,event.target.value);}catch{/* Session preference still works. */}}}><option value="">{playbackLabels.auto}</option>{localeVoices.map(voice=><option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}</select></label>;
 const session=useRef(null),timer=useRef(null),messageTimer=useRef(null);
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 function stop(){const current=session.current;session.current=null;clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);clearTimeout(startupTimer.current);clearTimeout(silenceTimer.current);setRecognitionHint('');setTalking(false);clearTimeout(timer.current);clearTimeout(releaseTimer.current);if(current){current.onspeechstart=null;current.onspeechend=null;current.onsoundstart=null;current.onsoundend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}setListening(false);setPhase('idle');}
 function finish(){if(!session.current||phase==='processing')return;const value=pendingPhrase.current;stop();if(value)lifecycle.current.handlePhrase(value);else notify(noSpeech);}

 function notify(value){if(review)setSaveError(value);else setAnswer('');setMessage(value);clearTimeout(messageTimer.current);messageTimer.current=setTimeout(()=>setMessage(''),6500);}
 useEffect(()=>{
  mounted.current=true;
  const cancel=()=>{if(document.hidden){stop();stopSpeaking();setMessage('');}};
  document.addEventListener('visibilitychange',cancel);
  return ()=>{mounted.current=false;cue.current?.close().catch(()=>{});cue.current=null;document.removeEventListener('visibilitychange',cancel);clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);clearTimeout(startupTimer.current);clearTimeout(silenceTimer.current);clearTimeout(audioTimer.current);clearTimeout(releaseTimer.current);if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;utterance.current=null;window.speechSynthesis?.cancel();}clearTimeout(timer.current);clearTimeout(messageTimer.current);const current=session.current;session.current=null;if(current){current.onspeechstart=null;current.onspeechend=null;current.onsoundstart=null;current.onsoundend=null;current.onstart=null;current.onresult=null;current.onerror=null;current.onend=null;current.abort();}};
 },[]);
 useEffect(()=>{const begin=()=>lifecycle.current.start();window.addEventListener('dayris-start-voice',begin);return()=>window.removeEventListener('dayris-start-voice',begin);},[]);
 useEffect(()=>{requestGeneration.current++;conversationContext.current=null;lastSavedEntry.current=null;setShowCapabilities(false);setHeard('');setChoices([]);setNextHelp(null);setContextLabel('');if(saveBusy.current||voiceBatchHasProgress(saveProgress.current))return;entryDraft.current=null;batchDraft.current=null;setBatch(null);setReview(null);setQuestionField(null);stop();stopSpeaking();setActive(false);setMessage('');setAnswer('');setAnswerAction(null);clearTimeout(messageTimer.current);},[locale,userId]);
 function cancelDraft(){if(saveBusy.current)return;handlers.current.onResetConversation?.();requestGeneration.current++;conversationContext.current=null;lastSavedEntry.current=null;setShowCapabilities(false);setHeard('');setNextHelp(null);setChoices([]);setContextLabel('');setCompact(false);entryDraft.current=null;batchDraft.current=null;setBatch(null);setReview(null);setQuestionField(null);setSaveError('');setSaveLocked(false);saveProgress.current={};stop();stopSpeaking();setActive(false);setAnswer('');setAnswerAction(null);setMessage('');}
 function changeReview(entry){if(saveBusy.current||saveLocked)return;if(batchDraft.current){const next={...batchDraft.current,states:batchDraft.current.states.map((state,index)=>index===batchDraft.current.activeIndex?{entry}:state)};batchDraft.current=next;setBatch(next);}entryDraft.current=entry;setReview(entry);setSaveError('');}
 function applyDialog(dialog){
  if(dialog?.entry&&entryDraft.current?.mutation)dialog={...dialog,entry:{...dialog.entry,mutation:true,beforeAmount:entryDraft.current.beforeAmount,mutationSnapshot:entryDraft.current.mutationSnapshot}};
  if(dialog?.entry||dialog?.draft){setNextHelp(null);setChoices([]);setCompact(false);}
  if(dialog?.batch){batchDraft.current=dialog.batch;setBatch(dialog.batch);}
  if(dialog?.cancelled){cancelDraft();return true;}
  if(dialog?.invalid){setSaveError(text.invalid);setAudioError(text.invalid);return true;}
  if(dialog?.entry){entryDraft.current=dialog.entry;setReview(dialog.entry);setQuestionField(null);setAnswer('');setMessage('');setAudioError('');setSaveError('');setActive(true);releaseTimer.current=setTimeout(()=>start(true),220);return true;}
  if(dialog?.draft){entryDraft.current=dialog.draft;setReview(null);setQuestionField(dialog.field);setMessage('');setAnswer(dialog.prompt);releaseTimer.current=setTimeout(()=>respond(dialog.prompt,()=>start(true)),180);return true;}
  return false;
 }
 function selectBatch(index){if(saveBusy.current||saveLocked)return;applyDialog(selectVoiceBatchEntry(batchDraft.current,index,locale));}
 function removeBatchEntry(){if(saveBusy.current||saveLocked||!batchDraft.current)return;const next={...batchDraft.current,states:batchDraft.current.states.filter((_,index)=>index!==batchDraft.current.activeIndex)};applyDialog(selectVoiceBatchEntry(next,Math.min(next.activeIndex,next.states.length-1),locale));}
 async function saveEntry(){
  if(saveBusy.current||!entryDraft.current||!review)return;
  const saveHandlers=handlers.current,saveOwner=saveHandlers.userId;
  const saveOne=(item,progress)=>{if(handlers.current.userId!==saveOwner)throw new Error('Аккаунт изменился. Начните запись заново.');return saveHandlers.onSaveEntry?saveHandlers.onSaveEntry(item,progress):saveHandlers.onCommand(item);};
  const entry={...entryDraft.current},entries=batchDraft.current?.states.map(state=>state.entry);const group=saveProgress.current.undoGroup||(saveProgress.current.undoGroup=globalThis.crypto?.randomUUID?.()||String(Date.now()));if(entries){saveProgress.current.entries??=entries.map(()=>({}));saveProgress.current.entries.forEach(progress=>progress.undoGroup=group);}saveBusy.current=true;setSaving(true);setSaveError('');stop();stopSpeaking();
  try{
   if(entry.mutation)await saveHandlers.onCommand({type:'voice-confirm',entry});
   else if(entries)await saveVoiceBatch(entries,saveProgress.current,saveOne);
   else await saveOne(entry,saveProgress.current);
   if(!mounted.current||handlers.current.userId!==saveOwner)return;
   lastSavedEntry.current={...(entries?.at(-1)||entry)};
   entryDraft.current=null;batchDraft.current=null;setBatch(null);setReview(null);setQuestionField(null);saveProgress.current={};setSaveLocked(false);setActive(true);
   const reply=entries?({ru:`Сохранено записей: ${entries.length}.`,en:`Saved ${entries.length} entries.`,ro:`Am salvat ${entries.length} înregistrări.`,zh:`已保存${entries.length}条记录。`}[locale]):shortEntryAnswer(entry,locale);setAnswer(entry.mutation?interactionCopy.amountUpdated:reply);setMessage('');setNextHelp({filtered:true,title:interactionCopy.next,phrases:interactionCopy.after});respond(entry.mutation?interactionCopy.amountUpdated:reply,()=>start(true));
  }catch(error){if(mounted.current){const count=saveProgress.current.entries?.filter(item=>item.done).length||0;const prefix=entries?({ru:`Сохранено ${count} из ${entries.length}. `,en:`Saved ${count} of ${entries.length}. `,ro:`Salvat ${count} din ${entries.length}. `,zh:`已保存${count}条，共${entries.length}条。`}[locale]):'';setSaveError(prefix+(error.message||text.error));setSaveLocked(voiceBatchHasProgress(saveProgress.current));}}
  finally{saveBusy.current=false;if(mounted.current){setSaving(false);if(handlers.current.userId!==saveOwner){saveProgress.current={};cancelDraft();}}}
 }
 async function handlePhrase(phrase){
  if(saveBusy.current||saveLocked||!phrase.trim())return;
  if(isVoiceHelpRequest(phrase)){
   requestGeneration.current++;setHeard(phrase);setTranscript('');setCompact(false);setChoices([]);setAnswerAction(null);setMessage('');setAudioError('');setSaveError('');setShowCapabilities(true);setActive(true);
   const catalog=voiceCapabilities(locale,{walletAvailable,traderMode});respond(catalog.summary,()=>start(true));return;
  }
  setShowCapabilities(false);
  if(!entryDraft.current){const followup=followupVoiceEntry(phrase,lastSavedEntry.current,locale,categoryOptions,{defaultCurrency,walletAvailable,baseDate:handlers.current.selectedDate});if(followup){setHeard(phrase);setCompact(false);setAnswerAction(null);requestGeneration.current++;applyDialog(followup);return;}}
  setHeard(phrase);setCompact(false);setChoices([]);setAnswerAction(null);const request=++requestGeneration.current;
  // Only an explicit save command submits a reviewed draft.
  if(review&&/^(?:сохрани(?: все| всё)?|сохранить(?: все| всё)?|да сохрани|保存|确认保存|全部保存|save(?: it| all)?|salvează(?: tot)?|salveaza(?: tot)?)$/i.test(phrase.trim())){saveEntry();return;}
  if(!entryDraft.current&&onConversation){
   try{const reply=await handlers.current.onConversation(phrase,conversationContext.current);if(!mounted.current||request!==requestGeneration.current)return;if(reply){
     if(reply.type==='conversation-entry'){const prepared=prepareConversationEntry(reply.phrase,{baseDate:reply.dateKey||handlers.current.selectedDate,context:conversationContext.current});phrase=prepared.phrase;conversationContext.current={period:'exact-day',dateKey:reply.dateKey||prepared.dateKey||localDateKey()};}
     else {let result=reply.delegate?await handlers.current.onCommand(reply.delegate):reply;if(!mounted.current||request!==requestGeneration.current)return;if(result?.context)conversationContext.current=result.context;if(result?.contextLabel)setContextLabel(result.contextLabel);if(applyDialog(result))return;if(result!==undefined){receiveReply(result);return;}if(reply.delegate){setActive(false);return;}}
   }}catch(error){setActive(true);setAnswer(error.message||text.error);return;}
  }
  const standalone=parseCalendarVoiceCommand(phrase);
  const prepared=!entryDraft.current&&(!standalone||standalone.type==='entry')?prepareConversationEntry(phrase,{baseDate:handlers.current.selectedDate,context:conversationContext.current}):null;
  if(prepared?.invalid){setAnswer('Не разобрал дату. Назовите один день.');return;}
  if(prepared){phrase=prepared.phrase;if(prepared.dateKey)phrase+=` ${prepared.dateKey}`;}
  const multi=batchDraft.current?voiceEntryBatch(phrase,batchDraft.current,locale,categoryOptions,{defaultCurrency,walletAvailable}):!entryDraft.current&&voiceEntryBatch(phrase,null,locale,categoryOptions,{defaultCurrency,walletAvailable});
  if(applyDialog(multi))return;
  const dialog=voiceEntryReview(phrase,entryDraft.current,locale,categoryOptions,{defaultCurrency,askDestination,walletAvailable});
  if(applyDialog(dialog))return;
  if(entryDraft.current){setSaveError(text.invalid);setAudioError(text.invalid);return;}
  const command=parseCalendarVoiceCommand(phrase);
  if(!command){setAnswer('');setNextHelp(null);notify(text.invalid);return;}
  setQuestionField(null);setMessage('');setAnswer('');setAudioError('');let reply;
  try{reply=await handlers.current.onCommand(command);}catch(error){console.error('DAYRIS voice action failed',error);setActive(true);notify(error.message||text.error);return;}
  if(mounted.current&&request===requestGeneration.current)receiveReply(reply);

 }
 function receiveReply(reply){
  const value=typeof reply==='string'?reply:reply?.text;
  if(!value){conversationContext.current=null;setContextLabel('');handlers.current.onResetConversation?.();setActive(false);return;}
  if(Object.hasOwn(reply,'context'))conversationContext.current=reply.context;
  if(Object.hasOwn(reply,'contextLabel'))setContextLabel(reply.contextLabel);
  if(reply?.help)setNextHelp({filtered:true,title:locale==='ru'?'Можно сказать дальше':'Continue with',phrases:reply.help});else setNextHelp(null);
  setChoices(reply?.choices||[]);setCompact(Boolean(reply?.compact));setActive(true);setAnswer(value);
  if(typeof reply?.onAction==='function')setAnswerAction({label:reply.actionLabel,run:reply.onAction});
  releaseTimer.current=setTimeout(()=>respond(value,()=>start(true)),120);
 }
 async function processPhrase(value){setPhase('processing');try{await handlePhrase(value);}finally{if(mounted.current&&!session.current)setPhase('idle');}}
 function submitReply(value){if(!value.trim())return;stop();stopSpeaking();setTranscript('');processPhrase(value);}
 function start(automatic=false,retry=0){
  if(saveBusy.current||saveLocked)return;
  if(session.current){finish();return;}
  clearTimeout(releaseTimer.current);stopSpeaking();if(automatic!==true&&!entryDraft.current){setAnswer('');setHeard('');}setAudioError('');setRecognitionHint('');setTranscript('');pendingPhrase.current='';setActive(true);window.speechSynthesis?.getVoices();
  // Keep iOS's recording channel free of cue playback and silent TTS warmups.
  if(automatic!==true){setAnswerAction(null);if(!isIOS){if(!cue.current)cue.current=prepareVoiceCue();else cue.current.resume().catch(()=>{});}}
  if(!Speech){notify(text.unsupported);return;}
  const recognition=new Speech();session.current=recognition;let finalText='',latestText='',startedAt=0;
  recognition.lang={
  zh: "zh-CN",ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale];recognition.continuous=true;recognition.interimResults=true;recognition.maxAlternatives=3;
  clearTimeout(messageTimer.current);setListening(false);setPhase('starting');setMessage(ui.opening);
  recognition.onstart=()=>{if(session.current===recognition){startedAt=Date.now();clearTimeout(startupTimer.current);setListening(true);setPhase('listening');setMessage(ui.listen);if(!isIOS)playVoiceCue(cue.current);silenceTimer.current=setTimeout(()=>{if(session.current===recognition&&!latestText)setRecognitionHint({ru:'Пока не слышу речи',en:'No speech detected yet',ro:'Încă nu aud vocea',zh:'暂未检测到语音'}[locale]);},8000);}};
  recognition.onsoundstart=()=>{if(session.current===recognition){clearTimeout(silenceTimer.current);setTalking(true);setRecognitionHint({ru:'Слышу звук…',en:'Sound detected…',ro:'Aud sunet…',zh:'检测到声音…'}[locale]);}};
  recognition.onsoundend=()=>{if(session.current===recognition)setTalking(false);};
  recognition.onspeechstart=()=>{if(session.current===recognition){clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);clearTimeout(silenceTimer.current);setRecognitionHint('');setTalking(true);}};
  recognition.onspeechend=()=>{if(session.current===recognition){clearTimeout(speechPulseTimer.current);setTalking(false);}};
  recognition.onresult=event=>{
   if(session.current!==recognition)return;
   clearTimeout(silenceTimer.current);setRecognitionHint('');
   const results=Array.from(event.results);
   const finalResults=results.filter(result=>result.isFinal);
   finalText=finalResults.map(result=>result[0].transcript).join(' ').trim();
   // A single-result recognizer can offer a better alternative for the whole phrase.
   if(finalResults.length===1&&!entryDraft.current)finalText=Array.from(finalResults[0]).map(item=>item.transcript).find(value=>{const command=voiceEntryBatch(value,null,locale,categoryOptions,{walletAvailable})?.entry||voiceEntryReview(value,null,locale,categoryOptions,{walletAvailable})?.entry||parseCalendarVoiceCommand(value);return command&&command.type!=='category-prompt';})||finalText;
   latestText=results.map(result=>result[0].transcript).join(' ').trim();setCompact(false);
   clearTimeout(phraseTimer.current);clearTimeout(speechPulseTimer.current);
   const interim=results.some(result=>!result.isFinal);if(!interim)latestText=finalText;pendingPhrase.current=latestText;setTranscript(latestText);setTalking(interim);
   if(interim){speechPulseTimer.current=setTimeout(()=>setTalking(false),900);phraseTimer.current=setTimeout(()=>{if(session.current===recognition)finish();},1600);return;}
   const command=voiceEntryBatch(finalText,batchDraft.current,locale,categoryOptions,{defaultCurrency,walletAvailable})?.entry||voiceEntryReview(finalText,entryDraft.current,locale,categoryOptions,{defaultCurrency,walletAvailable})?.entry||(!entryDraft.current&&followupVoiceEntry(finalText,lastSavedEntry.current,locale,categoryOptions,{defaultCurrency,walletAvailable,baseDate:handlers.current.selectedDate})?.entry)||parseCalendarVoiceCommand(finalText)||parseVoiceConversation(finalText,conversationContext.current)||(entryDraft.current&&/^(?:сохрани|сохранить|save|salveaz|salveáz|保存)/i.test(finalText)?{type:'save'}:null);
   // Keep a brief pause available for the category or remaining words.
   phraseTimer.current=setTimeout(()=>{if(session.current===recognition)lifecycle.current.finish();},command&&command.type!=='category-prompt'?900:1900);
  };
  recognition.onerror=event=>{if(session.current!==recognition)return;if(event.error==='no-speech'&&pendingPhrase.current){finish();return;}stop();notify(event.error==='no-speech'?noSpeech:event.error==='audio-capture'?({ru:'Микрофон недоступен. Проверьте доступ и повторите.',en:'Microphone unavailable. Check access and retry.',ro:'Microfon indisponibil. Verifică accesul și repetă.',zh:'麦克风不可用，请检查权限后重试。'}[locale]):event.error==='not-allowed'||event.error==='service-not-allowed'?text.permission:event.error==='language-not-supported'?({
  zh: "设备不支持此语言识别，请检查 Google 语音输入语言。",ru:'Распознавание русского языка недоступно на устройстве. Проверьте языки голосового ввода Google.',en:'English recognition is unavailable. Check Google voice input languages.',ro:'Recunoașterea limbii române nu este disponibilă. Verifică limbile introducerii vocale Google.'}[locale]):text.error);};
  recognition.onend=()=>{if(session.current!==recognition)return;const phrase=latestText||finalText;const early=startedAt&&Date.now()-startedAt<1200;stop();if(phrase){lifecycle.current.handlePhrase(phrase);return;}if(early&&retry===0&&!document.hidden){setPhase('starting');releaseTimer.current=setTimeout(()=>lifecycle.current.start(true,1),350);return;}notify(noSpeech);};
  try{recognition.start();if(!startedAt)startupTimer.current=setTimeout(()=>{if(session.current===recognition&&!startedAt){stop();notify(text.error);}},8000);timer.current=setTimeout(()=>{if(session.current===recognition)finish();},20000);}catch{stop();notify(text.error);}
 }
 const idleStatus={ru:'Микрофон на паузе',en:'Microphone paused',ro:'Microfon pe pauză',zh:'麦克风已暂停'}[locale];
 const speakingStatus={ru:'Отвечаю…',en:'Speaking…',ro:'Răspund…',zh:'正在回答…'}[locale];
 return <div className="calendar-voice-control" data-light={Boolean(isLight)} data-active={active} data-phase={speaking?'speaking':phase}>
  <button type="button" className="calendar-voice-button" disabled={phase==='processing'||saving||saveLocked} onClick={start} aria-pressed={listening} aria-label={listening?ui.done:text.start} title={text.start}><span className="calendar-voice-glyph" data-talking={talking&&phase==='listening'} aria-hidden="true"><span className="calendar-voice-equalizer"><i/><i/><i/></span>{phase==='processing'?<Square size={15}/>:<Mic size={18}/>}<span className="calendar-voice-equalizer"><i/><i/><i/></span></span> {active&&<span>{listening?(phase==='processing'?ui.processing:phase==='starting'?ui.opening:ui.done):speaking?({
  zh: "正在播放",ru:'Отвечаю',en:'Speaking',ro:'Răspund'}[locale]):text.start}</span>}</button>

  {(active||review||answer||message)&&<VoiceWorkspace locale={locale} isLight={isLight} phrase={transcript||heard}
   contextLabel={contextLabel} compact={compact} phase={speaking?'speaking':phase} talking={talking} status={saving?interactionCopy.saving:phase==='starting'?ui.opening:phase==='processing'?ui.processing:listening?recognitionHint||ui.listen:speaking?speakingStatus:message&&!['',ui.listen,ui.opening].includes(message)?message:idleStatus}
   help={transcript?compactHelp:nextHelp||(review?{filtered:true,title:interactionCopy.correct,phrases:batch?interactionCopy.batch:review.mutation?interactionCopy.mutation:interactionCopy.entry}:compactHelp)}
   onClose={cancelDraft} onExpand={()=>setCompact(false)} onCollapse={()=>setCompact(true)} onListen={()=>start()} onSuggestion={submitReply} choices={choices} listening={listening} busy={saving||phase==='processing'} resultKey={review?(batch?'batch':'review'):answer||'idle'}
   settings={<>{feedbackControl}{localeVoices.length>0?voicePicker:<p className="calendar-voice-help-note">{playbackLabels.missing}</p>}</>}
  >  {showCapabilities&&<VoiceCapabilities catalog={voiceCapabilities(locale,{walletAvailable,traderMode})}/>}
  {review&&(batch?<VoiceBatchCard batch={batch} locale={locale} categories={categoryOptions} onCreateCategory={onCreateCategory} onDeleteCategory={onDeleteCategory} userId={userId} isLight={isLight} walletAvailable={walletAvailable} onSelect={selectBatch} onChange={changeReview} onManualEdit={()=>{stop();stopSpeaking();}} onRemove={removeBatchEntry} onSave={saveEntry} onCancel={cancelDraft} busy={saving} listening={listening} error={saveError} locked={saveLocked} progress={saveProgress.current}></VoiceBatchCard>:<VoiceEntryCard entry={review} locale={locale} categories={categoryOptions} onCreateCategory={onCreateCategory} onDeleteCategory={onDeleteCategory} userId={userId} isLight={isLight} walletAvailable={walletAvailable} onChange={changeReview} onManualEdit={()=>{stop();stopSpeaking();}} onSave={saveEntry} onCancel={cancelDraft} busy={saving} listening={listening} error={saveError} locked={saveLocked}></VoiceEntryCard>)}
  {review&&listening&&<div className="calendar-voice-live" role="status" aria-live="polite">{phase==='starting'?ui.opening:phase==='processing'?ui.processing:ui.listen}{transcript&&<span>«{transcript}»</span>}</div>}
  {answer&&!review&&!showCapabilities&&<div className="calendar-voice-message calendar-voice-answer">
   <p role="status" aria-live="polite">{answer}</p>
   {answerAction&&<button type="button" className="calendar-voice-result-action" onClick={()=>{stop();stopSpeaking();answerAction.run();setCompact(true);releaseTimer.current=setTimeout(()=>start(true),220);}}>{answerAction.label}</button>}
   {listening&&entryDraft.current&&<p>{ui.listen}{transcript&&` · ${transcript}`}</p>}
   {audioError&&<p className="calendar-voice-audio-error" role="alert">{audioError}</p>}

   {questionField&&<VoiceReplyControls key={questionField+answer} field={questionField} locale={locale} userId={userId} isLight={isLight} defaultCurrency={defaultCurrency} walletAvailable={walletAvailable} categories={categoryOptions} item={entryDraft.current?.item} today={localDateKey()} onReply={submitReply} onVoice={()=>{stop();start(true);}} onCreateCategory={onCreateCategory} onDeleteCategory={onDeleteCategory} onPickerOpen={()=>{stop();stopSpeaking();}}/>}

<div className="calendar-voice-answer-actions">{window.speechSynthesis&&window.SpeechSynthesisUtterance&&<button type="button" aria-label={speaking?audioText.stop:audioText.play} onClick={()=>speaking?stopSpeaking():speak(answer,entryDraft.current?()=>start(true):undefined)}>{speaking?<Square size={16}/>:<Volume2 size={18}/>}<span>{speaking?audioText.stop:audioText.play}</span></button>}<button type="button" aria-label={audioText.close} onClick={cancelDraft}><X size={18}/></button></div></div>}
  {message&&!answer&&!review&&<div className="calendar-voice-message"><div className="calendar-assistant-heading"><Mic size={14}/><span>DAYRIS</span><small>{locale === 'zh' ? "助手" : (locale==='ru'?'Помощник':locale==='en'?'Assistant':'Asistent')}</small></div><p role="status" aria-live="polite">{message}</p>{listening&&<p>{ui.hint}</p>}{transcript&&<p className="calendar-voice-transcript">«{transcript}»</p>}</div>}</VoiceWorkspace>}
 </div>;
}
