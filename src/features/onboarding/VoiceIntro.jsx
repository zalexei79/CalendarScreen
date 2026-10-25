import React, {useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight, Mic, Pause, Play, Volume2, VolumeX, X} from 'lucide-react';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import './VoiceIntro.css';

const COPY = {
 ru: {title:'Одна фраза — и запись готова.',hint:'Скажи сумму и на что потратил. Помощник разберёт фразу.',eyebrow:'Твой голос — твой помощник',example:'«Сегодня потратил 20 долларов на продукты»',try:'Попробовать голосом',now:'Твой ход',skip:'Попробовать сразу',close:'Закрыть знакомство с микрофоном',video:'Как пользоваться голосовым помощником DAYRIS',play:'Смотреть видео',pause:'Пауза',mute:'Выключить звук',unmute:'Включить звук',loading:'Готовим знакомство…',failed:'Видео не загрузилось. Можешь сразу попробовать голосовой ввод.'},
 en: {title:'One phrase. Your entry is ready.',hint:'Say the amount and what it was for. Your assistant will work it out.',eyebrow:'Your voice. Your assistant.',example:'“Today I spent 20 dollars on groceries”',try:'Try voice input',now:'Your turn',skip:'Try it now',close:'Close microphone introduction',video:'How to use the DAYRIS voice assistant',play:'Watch video',pause:'Pause',mute:'Turn sound off',unmute:'Turn sound on',loading:'Getting ready…',failed:'The video could not load. You can try voice input now.'},
 ro: {title:'O frază. Înregistrarea e gata.',hint:'Spune suma și pe ce ai cheltuit. Asistentul va înțelege fraza.',eyebrow:'Vocea ta. Asistentul tău.',example:'„Astăzi am cheltuit 20 de dolari pe alimente”',try:'Încearcă vocea',now:'Rândul tău',skip:'Încearcă acum',close:'Închide prezentarea microfonului',video:'Cum folosești asistentul vocal DAYRIS',play:'Vezi videoclipul',pause:'Pauză',mute:'Dezactivează sunetul',unmute:'Activează sunetul',loading:'Pregătim prezentarea…',failed:'Videoclipul nu s-a încărcat. Poți încerca direct vocea.'},
 uk: {title:'Одна фраза — і запис готовий.',hint:'Скажи суму й на що витратив. Помічник розбере фразу.',eyebrow:'Твій голос — твій помічник',example:'«Сьогодні витратив 20 доларів на продукти»',try:'Спробувати голосом',now:'Твоя черга',skip:'Спробувати зараз',close:'Закрити знайомство з мікрофоном',video:'Як користуватися голосовим помічником DAYRIS',play:'Переглянути відео',pause:'Пауза',mute:'Вимкнути звук',unmute:'Увімкнути звук',loading:'Готуємо знайомство…',failed:'Відео не завантажилося. Можна одразу спробувати голосове введення.'},
 zh: {title:'一句话，记录就绪。',hint:'说出金额和用途，助手会理解你的话。',eyebrow:'你的声音，你的助手',example:'“今天买食品花了20美元”',try:'试试语音输入',now:'轮到你了',skip:'现在试试',close:'关闭麦克风介绍',video:'如何使用 DAYRIS 语音助手',play:'观看视频',pause:'暂停',mute:'关闭声音',unmute:'开启声音',loading:'正在准备介绍…',failed:'视频加载失败。你可以直接试用语音输入。'},
};

export default function VoiceIntro({language='ru', onTry, onDismiss, onComplete}) {
 const lang=language.startsWith('zh')?'zh':language==='md'?'ro':language;
 const copy=COPY[lang]||COPY.ru;
 const dialogRef=useRef(null),videoRef=useRef(null),micRef=useRef(null),ghostRef=useRef(null);
 const alive=useRef(true),leaving=useRef(false),frames=useRef([]),animation=useRef(null),restoreFocus=useRef(null);
 const [ready,setReady]=useState(false),[invited,setInvited]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[muted,setMuted]=useState(false),[paused,setPaused]=useState(false),[blocked,setBlocked]=useState(false),[phase,setPhase]=useState('film');
 const play=async()=>{
  if(leaving.current)return;
  try{await videoRef.current.play();if(alive.current){setPaused(false);setBlocked(false)}}
  catch{if(!alive.current||leaving.current)return;videoRef.current.muted=true;setMuted(true);try{await videoRef.current.play();if(alive.current){setPaused(false);setBlocked(false)}}catch{if(alive.current){setBlocked(true);setPaused(true)}}}
 };
 useLayoutEffect(()=>{
  alive.current=true;restoreFocus.current=document.activeElement;
  const dialog=dialogRef.current,media=videoRef.current;dialog.showModal();dialog.querySelector('h1')?.focus();
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setPaused(true);setBlocked(true)}else play();
  const timeout=setTimeout(()=>{if(videoRef.current?.readyState<2)setFailed(true)},12000);
  const hide=()=>{if(document.hidden){videoRef.current?.pause();setPaused(true)}};
  document.addEventListener('visibilitychange',hide);
  return()=>{alive.current=false;clearTimeout(timeout);document.removeEventListener('visibilitychange',hide);frames.current.forEach(cancelAnimationFrame);animation.current?.cancel();media.pause();dialog.close();if(!leaving.current&&restoreFocus.current?.isConnected)restoreFocus.current.focus({preventScroll:true})};
 },[]);
 useLayoutEffect(()=>{if(ready)micRef.current?.focus({preventScroll:true})},[ready]);
 const complete=()=>{if(!alive.current)return;onComplete();requestAnimationFrame(()=>document.querySelector('.voice-workspace-mic')?.focus({preventScroll:true}))};
 const begin=event=>{
  if(leaving.current)return;
  leaving.current=true;videoRef.current.pause();videoRef.current.muted=true;
  const pressedMic=event?.currentTarget?.matches('.voice-intro-mic,.voice-intro-film-mic')?event.currentTarget:null;
  const source=(pressedMic||micRef.current||document.querySelector('.calendar-voice-button')||dialogRef.current.querySelector('.voice-intro-skip')).getBoundingClientRect();
  Object.assign(ghostRef.current.style,{left:`${source.x}px`,top:`${source.y}px`,width:`${source.width}px`,height:`${source.height}px`});
  // Start recognition within this trusted click, before any animation/await.
  if(onTry()===false){onComplete();return;}
  setPhase('leaving');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){complete();return;}
  frames.current.push(requestAnimationFrame(()=>frames.current.push(requestAnimationFrame(async()=>{
   const target=document.querySelector('.voice-workspace-mic')?.getBoundingClientRect();
   const transform=target?`translate(${target.x-source.x}px,${target.y-source.y}px) scale(${target.width/source.width},${target.height/source.height})`:'scale(.85)';
   animation.current=ghostRef.current.animate([{transform:'none',opacity:1},{transform,opacity:0}],{duration:600,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'});
   try{await animation.current.finished}catch{}
   complete();
  }))));
 };
 const finish=()=>{if(leaving.current)return;setReady(true);setInvited(true);setPaused(true)};
 return createPortal(<dialog ref={dialogRef} className="voice-intro" data-phase={phase} data-ready={ready||failed} lang={lang==='zh'?'zh-CN':lang} aria-labelledby="voice-intro-heading" onCancel={event=>{event.preventDefault();if(!leaving.current)onDismiss()}}>
  <div className="voice-intro-atmosphere" aria-hidden="true"/>
  <button type="button" className="voice-intro-close" aria-label={copy.close} onClick={onDismiss} disabled={phase==='leaving'}><X size={20}/></button>
  <div className="voice-intro-stage">
   <div className="voice-intro-film" data-ready={ready||failed} data-invited={invited||failed} data-loaded={loaded}>
    <video ref={videoRef} src="/onboarding/voice-intro-ru.mp4" playsInline preload="auto" muted={muted} disablePictureInPicture aria-label={copy.video} onLoadedData={()=>{setLoaded(true);setFailed(false)}} onError={()=>setFailed(true)} onTimeUpdate={event=>{if(event.currentTarget.currentTime>=event.currentTarget.duration-1.4)setInvited(true)}} onEnded={finish} onPause={()=>setPaused(true)} onPlaying={()=>{setPaused(false);setBlocked(false)}}/>
    {!failed&&(!loaded||blocked)&&<div className="voice-intro-status" role="status">{blocked?<button type="button" onClick={play}><Play size={18}/>{copy.play}</button>:copy.loading}</div>}
    <button type="button" className="voice-intro-invitation" aria-hidden={!ready&&!failed} onClick={begin} tabIndex={ready||failed?0:-1} disabled={(!ready&&!failed)||phase==='leaving'}><span>{copy.now}</span><strong>{copy.try}</strong><small>{copy.example}</small></button>
    {(invited||failed)&&<button ref={micRef} type="button" className="voice-intro-mic" aria-label={copy.try} onClick={begin} disabled={phase==='leaving'}><Mic/></button>}
    {ready&&!failed&&<button type="button" className="voice-intro-film-mic" aria-label={copy.try} onClick={begin} disabled={phase==='leaving'}/> }
    {failed&&<p className="voice-intro-error" role="status">{copy.failed}</p>}
   </div>
   <aside className="voice-intro-story"><div className="voice-intro-brand"><BrandIcon/>DAYRIS</div><span className="voice-intro-eyebrow">{copy.eyebrow}</span><h1 id="voice-intro-heading" tabIndex={-1}>{copy.title}</h1><p>{copy.hint}</p><blockquote>{copy.example}</blockquote><div className="voice-intro-wave" aria-hidden="true">{Array.from({length:25},(_,i)=><i key={i} style={{'--bar':i,'--bar-height':`${7+(i*7)%23}px`}}/>)}</div><button type="button" className="voice-intro-skip" onClick={begin} disabled={phase==='leaving'}>{copy.skip}<ArrowRight size={17}/></button></aside>
  </div>
  <div className="voice-intro-playback">{!failed&&loaded&&!ready&&<button type="button" onClick={()=>paused?play():videoRef.current.pause()} aria-label={paused?copy.play:copy.pause}>{paused?<Play size={17}/>:<Pause size={17}/>}</button>}{!failed&&!ready&&<button type="button" onClick={()=>{videoRef.current.muted=!muted;setMuted(!muted)}} aria-label={muted?copy.unmute:copy.mute}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>} {muted&&<span>{copy.unmute}</span>}</button>}</div>
  <div ref={ghostRef} className="voice-intro-handoff" aria-hidden="true" inert=""><Mic/></div>
 </dialog>,document.body);
}
