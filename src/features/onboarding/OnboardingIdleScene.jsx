import React, { useLayoutEffect, useRef, useState } from 'react';
import desktopPlate from '../../assets/onboarding/idle-desktop.webp';
import mobilePlate from '../../assets/onboarding/idle-mobile.webp';
import presenter from '../../assets/onboarding/presenter-emotions.webp';
import angryPresenter from '../../assets/onboarding/presenter-angry.webp';
import PresenterFaceMorph from './PresenterFaceMorph.jsx';
import './OnboardingIdleScene.css';

// Only restore the areas occupied by the baked-in presenter and connector.
// The original video keeps ownership of every other pixel of the interface.
export default function OnboardingIdleScene({ mobile, visible, emotion, expired, waiting }) {
  const sceneRef = useRef(null);
  const actorRef = useRef(null);
  const pathRef = useRef(null);
  const dotRef = useRef(null);
  const [loaded, setLoaded] = useState({});
  const markLoaded = key => setLoaded(previous => previous[key] ? previous : { ...previous, [key]: true });
  const prepared = loaded.plate && loaded.presenter && loaded.angry;
  const plate = mobile ? mobilePlate : desktopPlate;
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const target = scene.closest('.onboarding-video')?.querySelector(expired ? '.onboarding-video-expired button' : mobile ? '.onboarding-video-speaker-action' : '.onboarding-video-calendar-action');
    if (!target) return;
    const follow = () => {
      const frame = scene.getBoundingClientRect(), actor = actorRef.current.getBoundingClientRect(), button = target.getBoundingClientRect();
      if (!frame.width || !frame.height) return;
      const x = (actor.left + actor.width * .925 - frame.left) / frame.width * 1000;
      const y = (actor.top + actor.height * .635 - frame.top) / frame.height * 1000;
      const endX = (button.left + 4 - frame.left) / frame.width * 1000;
      const endY = (button.top + button.height / 2 - frame.top) / frame.height * 1000;
      const bend = Math.max(15, (endX - x) * .35);
      pathRef.current.setAttribute('d', `M ${x} ${y} C ${x + bend} ${y} ${endX - bend} ${endY} ${endX} ${endY}`);
      dotRef.current.setAttribute('cx', endX);
      dotRef.current.setAttribute('cy', endY);
    };
    const observer = new ResizeObserver(follow);
    [scene, actorRef.current, target].forEach(node => observer.observe(node));
    follow();
    return () => observer.disconnect();
  }, [mobile, expired, visible]);
  return <div ref={sceneRef} className="onboarding-idle" data-visible={Boolean(visible && prepared)} data-emotion={emotion} data-expired={expired} data-waiting={waiting} aria-hidden="true" inert="">
    <img className="onboarding-idle-plate onboarding-idle-person-plate" src={plate} alt="" onLoad={() => markLoaded('plate')} />
    <img className="onboarding-idle-plate onboarding-idle-line-plate" src={plate} alt="" />
    <img className="onboarding-idle-preload" src={presenter} alt="" onLoad={() => markLoaded('presenter')} />
    <img className="onboarding-idle-preload" src={angryPresenter} alt="" onLoad={() => markLoaded('angry')} />
    <div ref={actorRef} className="onboarding-idle-presenter">
      <div className="onboarding-idle-face is-smiling" style={{ backgroundImage: `url(${presenter})` }} />
      <PresenterFaceMorph emotion={emotion} sheet={presenter} angry={angryPresenter} active={Boolean(visible && prepared && waiting)} />
    </div>
    <svg className="onboarding-idle-connector" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <path ref={pathRef} className="onboarding-idle-flow" />
      <circle ref={dotRef} className="onboarding-idle-endpoint" r="4" />
    </svg>
  </div>;
}
