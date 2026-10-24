import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import OnboardingIdleScene from './OnboardingIdleScene.jsx';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import ruDesktop from '../../assets/onboarding/ru-desktop.mp4';
import ruMobile from '../../assets/onboarding/ru-mobile.mp4';
import enDesktop from '../../assets/onboarding/en-desktop.mp4';
import enMobile from '../../assets/onboarding/en-mobile.mp4';
import roDesktop from '../../assets/onboarding/ro-desktop.mp4';
import roMobile from '../../assets/onboarding/ro-mobile.mp4';
import ukDesktop from '../../assets/onboarding/uk-desktop.mp4';
import ukMobile from '../../assets/onboarding/uk-mobile.mp4';
import zhDesktop from '../../assets/onboarding/zh-desktop.mp4';
import zhMobile from '../../assets/onboarding/zh-mobile.mp4';
import { ONBOARDING_VIDEO_COPY } from './onboardingVideoCopy.js';
import './OnboardingVideo.css';

// Coordinates are relative to the supplied films, including their safe margins.
const GRID = { desktop: [.475, .456, .464, .433], mobile: [.083, .394, .834, .247] };
export const VIDEO_ENTRY_CUE = 19;
const FILMS = { ru: [ruDesktop, ruMobile], en: [enDesktop, enMobile], ro: [roDesktop, roMobile], uk: [ukDesktop, ukMobile], zh: [zhDesktop, zhMobile] };

export default function OnboardingVideo({ active, onStart, onSkip, onRestart, theme, lang = 'ru', initialMuted = false, onSoundChange }) {
  const copy = ONBOARDING_VIDEO_COPY[lang] || ONBOARDING_VIDEO_COPY.ru;
  const films = FILMS[lang] || FILMS.ru;
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const ghostRef = useRef(null);
  const alive = useRef(true);
  const phaseRef = useRef('loading');
  const transitionRef = useRef(null);
  const gridVisibilityRef = useRef(null);
  const startRef = useRef(onStart);
  const skipRef = useRef(onSkip);
  const restartButtonRef = useRef(null);
  startRef.current = onStart;
  skipRef.current = onSkip;
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState('loading');
  const [muted, setMuted] = useState(initialMuted);
  const [paused, setPaused] = useState(false);
  const [entryReady, setEntryReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const [idleStarted, setIdleStarted] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [restartEmotionIndex, setRestartEmotionIndex] = useState(0);
  const emotion = idleSeconds >= 20 ? 'angry' : idleSeconds >= 15 ? 'sad' : 'smile';
  const countdown = idleSeconds >= 20 ? Math.max(0, 30 - idleSeconds) : null;
  useEffect(() => { setMuted(initialMuted); }, [initialMuted]);
  const expired = phase === 'expired';

  useEffect(() => {
    if (!expired) return;
    let interval, started = null, elapsed = 0;
    setRestartEmotionIndex(0);
    const tick = () => {
      if (phaseRef.current !== 'expired') { clearInterval(interval); return; }
      setRestartEmotionIndex(Math.floor((elapsed + (started === null ? 0 : performance.now() - started)) / 10000) % 3);
    };
    const visibility = () => {
      clearInterval(interval);
      if (started !== null) elapsed += performance.now() - started;
      started = document.hidden ? null : performance.now();
      if (started !== null) { tick(); interval = setInterval(tick, 250); }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); };
  }, [expired]);

  useEffect(() => {
    if (phase !== 'ready') return;
    let interval;
    let elapsed = 0;
    let started = null;
    const tick = () => {
      if (phaseRef.current !== 'ready') { clearInterval(interval); return; }
      const seconds = Math.min(30, Math.floor((elapsed + (started === null ? 0 : performance.now() - started)) / 1000));
      setIdleSeconds(seconds);
      if (seconds === 30) { clearInterval(interval); changePhase('expired'); }
    };
    const visibility = () => {
      clearInterval(interval);
      if (started !== null) elapsed += performance.now() - started;
      started = document.hidden ? null : performance.now();
      if (started !== null) { tick(); interval = setInterval(tick, 250); }
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); };
  }, [phase]);

  useEffect(() => { if (expired) restartButtonRef.current?.focus(); }, [expired]);

  const changePhase = value => { phaseRef.current = value; setPhase(value); };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      transitionRef.current?.cancel();
      videoRef.current?.pause();
      const saved = gridVisibilityRef.current;
      if (saved) saved.node.style.visibility = saved.visibility;
    };
  }, []);
  useEffect(() => {
    if (active) return;
    const query = window.matchMedia('(max-width: 767px)');
    const change = () => { setMobile(query.matches); setLoaded(false); setFailed(false); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, [active]);

  const play = async () => {
    const video = videoRef.current;
    try {
      await video.play();
      if (alive.current) { setPaused(false); setPlayBlocked(false); }
    } catch {
      if (!alive.current || phaseRef.current === 'returning') return;
      // Mobile browsers can require a new gesture for sound after the life story.
      video.muted = true;
      setMuted(true);
      onSoundChange?.(true);
      try { await video.play(); if (alive.current) { setPaused(false); setPlayBlocked(false); } }
      catch { if (alive.current) { setPaused(true); setPlayBlocked(true); } }
    }
  };

  const animateCalendar = async reverse => {
    const grid = document.querySelector('.premium-shell .calendar-days-grid');
    const host = ghostRef.current;
    const frame = frameRef.current;
    if (!grid || !host || !frame || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const source = grid.getBoundingClientRect();
    const bounds = frame.getBoundingClientRect();
    const [x, y, w, h] = GRID[mobile ? 'mobile' : 'desktop'];
    const target = { x: bounds.x + x * bounds.width, y: bounds.y + y * bounds.height, width: w * bounds.width, height: h * bounds.height };
    const shell = document.querySelector('.premium-shell');
    host.className = `${shell.className} onboarding-video-ghost`;
    const clone = grid.cloneNode(true);
    clone.style.visibility = 'visible';
    for (const node of [clone, ...clone.querySelectorAll('*')]) { node.removeAttribute('id'); node.removeAttribute('aria-describedby'); }
    const section = grid.parentElement.cloneNode(false);
    section.removeAttribute('id');
    Object.assign(section.style, { padding: '0', margin: '0', border: '0', width: '100%', height: '100%', background: 'transparent' });
    section.append(clone);
    host.replaceChildren(section);
    if (!gridVisibilityRef.current) gridVisibilityRef.current = { node: grid, visibility: grid.style.visibility };
    grid.style.visibility = 'hidden';
    Object.assign(host.style, { left: `${source.x}px`, top: `${source.y}px`, width: `${source.width}px`, height: `${source.height}px` });
    // The cloned shell includes theme utility classes with !important backgrounds.
    host.style.setProperty('background', 'transparent', 'important');
    const native = 'translate(0,0) scale(1,1)';
    const embedded = `translate(${target.x - source.x}px,${target.y - source.y}px) scale(${target.width / source.width},${target.height / source.height})`;
    const frames = reverse
      ? [{ transform: embedded, opacity: 0 }, { transform: embedded, opacity: 1, offset: .2 }, { transform: native, opacity: 1 }]
      : [{ transform: native, opacity: 1 }, { transform: embedded, opacity: 1, offset: .78 }, { transform: embedded, opacity: 0 }];
    const animation = host.animate(frames, { duration: 950, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    transitionRef.current = animation;
    try { await animation.finished; } catch { /* Unmount cancels the visual bridge. */ }
    if (transitionRef.current === animation) {
      animation.cancel();
      host.replaceChildren();
      host.className = 'onboarding-video-ghost';
      host.removeAttribute('style');
      const saved = gridVisibilityRef.current;
      if (saved) saved.node.style.visibility = saved.visibility;
      gridVisibilityRef.current = null;
    }
  };

  useEffect(() => {
    if (!active || !loaded || phaseRef.current === 'returning') return;
    let cancelled = false;
    changePhase('entering');
    const enter = async () => {
      await animateCalendar(false);
      if (cancelled || !alive.current || phaseRef.current === 'returning') return;
      changePhase('playing');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPaused(true); setPlayBlocked(true); return; }
      await play();
    };
    enter();
    return () => { cancelled = true; transitionRef.current?.cancel(); };
  }, [active, loaded]);

  useEffect(() => {
    if (active) frameRef.current?.parentElement.querySelector('h1')?.focus();
  }, [active]);

  useEffect(() => {
    if (!active || loaded) return;
    const timer = setTimeout(() => setFailed(true), 12000);
    return () => clearTimeout(timer);
  }, [active, loaded]);

  const leave = async action => {
    if (phaseRef.current === 'returning') return;
    videoRef.current.pause();
    transitionRef.current?.cancel();
    changePhase('returning');
    await animateCalendar(true);
    if (alive.current) (action === 'entry' ? startRef : skipRef).current();
  };
  const ready = () => {
    if (phaseRef.current === 'returning') return;
    setEntryReady(true);
    setIdleStarted(true);
    changePhase('ready');
    setPaused(true);
  };

  return <section className="onboarding-video" data-active={active} data-phase={phase} data-theme={theme} aria-label={copy.intro} hidden={!active}>
    <h1 id={active ? 'first-run-heading' : undefined} className="sr-only" tabIndex={-1}>{copy.heading}</h1>
    <div className="onboarding-video-backdrop" />
    <div ref={frameRef} className={`onboarding-video-frame ${mobile ? 'is-mobile' : ''}`}>
      <video ref={videoRef} src={films[mobile ? 1 : 0]} playsInline preload="auto" muted={muted}
        aria-label={copy.video} disablePictureInPicture
        onLoadedData={() => { setLoaded(true); setFailed(false); }} onError={() => setFailed(true)}
        onTimeUpdate={event => { if (event.currentTarget.currentTime >= Math.min(VIDEO_ENTRY_CUE, event.currentTarget.duration - 1.25)) setEntryReady(true); }}
        onEnded={ready} onPause={() => setPaused(true)} onPlaying={() => { setPaused(false); setPlayBlocked(false); }} />
      {expired && <div className="onboarding-restart-atmosphere" aria-hidden="true" inert="">
        <div className="onboarding-restart-brand"><BrandIcon />DAYRIS</div>
        <div className="onboarding-restart-calendar">{Array.from({ length: 35 }, (_, index) => <span key={index} style={{ '--cell': index }} />)}</div>
      </div>}
      <OnboardingIdleScene mobile={mobile} visible={idleStarted} emotion={expired ? ['smile', 'sad', 'angry'][restartEmotionIndex] : emotion} expired={expired} waiting={phase === 'ready' || expired} />
      {entryReady && phase !== 'returning' && !expired && <>
        <button type="button" className="onboarding-video-calendar-action" aria-label={copy.calendar} onClick={() => leave('entry')}><span className="sr-only">{copy.first}</span></button>
        <button type="button" className="onboarding-video-speaker-action" onClick={() => leave('entry')}><span>{copy.try}</span><strong>{copy.add} <ArrowRight size={16} /></strong></button>
      </>}
      {!expired && <button type="button" className="onboarding-video-skip" onClick={() => leave('skip')} disabled={phase === 'returning'}>{copy.skip} <ArrowRight size={13} /></button>}
      {phase === 'ready' && countdown !== null && <div className="onboarding-video-countdown"><span>{copy.ending}</span><strong role="timer" aria-label={copy.remaining.replace('{seconds}', countdown)}>{countdown}</strong></div>}
      {expired && <div className="onboarding-video-expired"><h2>{copy.ended}</h2><button ref={restartButtonRef} type="button" onClick={onRestart}><RotateCcw size={18} />{copy.restart}</button></div>}
    </div>
    <div ref={ghostRef} className="onboarding-video-ghost" aria-hidden="true" inert="" />
    {!expired && <div className="onboarding-video-controls" hidden={phase === 'returning'}>
      {!failed && phase !== 'ready' && <button type="button" onClick={() => paused ? play() : videoRef.current.pause()} disabled={!loaded} aria-label={paused ? copy.resume : copy.pause}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>}
      {!failed && phase !== 'ready' && <button type="button" onClick={() => { videoRef.current.muted = !muted; setMuted(!muted); onSoundChange?.(!muted); }} aria-label={muted ? copy.unmute : copy.mute}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{muted && <span>{copy.unmute}</span>}</button>}
    </div>}
    {!expired && <p className="onboarding-video-status" data-announcement-only={phase === 'ready'} role="status">{failed ? copy.failed : playBlocked ? copy.blocked : !loaded ? copy.loading : phase === 'ready' ? copy.ready : ''}</p>}
    {failed && !expired && <button type="button" className="onboarding-video-fallback" onClick={() => leave('entry')}>{copy.first} <ArrowRight size={16} /></button>}
  </section>;
}
