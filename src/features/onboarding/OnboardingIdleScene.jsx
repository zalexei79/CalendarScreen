import React, { useState } from 'react';
import desktopPlate from '../../assets/onboarding/idle-desktop.webp';
import mobilePlate from '../../assets/onboarding/idle-mobile.webp';
import presenter from '../../assets/onboarding/presenter-emotions.webp';
import angryPresenter from '../../assets/onboarding/presenter-angry.webp';
import PresenterFaceMorph from './PresenterFaceMorph.jsx';
import './OnboardingIdleScene.css';

// Only restore the areas occupied by the baked-in presenter and connector.
// The original video keeps ownership of every other pixel of the interface.
export default function OnboardingIdleScene({ mobile, visible, emotion, expired, waiting }) {
  const [loaded, setLoaded] = useState({});
  const markLoaded = key => setLoaded(previous => previous[key] ? previous : { ...previous, [key]: true });
  const prepared = loaded.plate && loaded.presenter && loaded.angry;
  const plate = mobile ? mobilePlate : desktopPlate;
  return <div className="onboarding-idle" data-visible={Boolean(visible && prepared)} data-emotion={emotion} data-expired={expired} data-waiting={waiting} aria-hidden="true" inert="">
    <img className="onboarding-idle-plate onboarding-idle-person-plate" src={plate} alt="" onLoad={() => markLoaded('plate')} />
    <img className="onboarding-idle-plate onboarding-idle-line-plate" src={plate} alt="" />
    <img className="onboarding-idle-preload" src={presenter} alt="" onLoad={() => markLoaded('presenter')} />
    <img className="onboarding-idle-preload" src={angryPresenter} alt="" onLoad={() => markLoaded('angry')} />
    <div className="onboarding-idle-presenter">
      <div className="onboarding-idle-face is-smiling" style={{ backgroundImage: `url(${presenter})` }} />
      <PresenterFaceMorph emotion={emotion} sheet={presenter} angry={angryPresenter} active={Boolean(visible && prepared && waiting)} />
    </div>
    <svg className="onboarding-idle-connector" viewBox="0 0 1000 1000" preserveAspectRatio="none">
      <path className="onboarding-idle-flow" d={expired ? mobile ? 'M 389 855 Q 425 860 460 860' : 'M 341 773 C 439 773 527 825 605 825' : mobile ? 'M 389 855 Q 419 838 453 818' : 'M 341 773 C 425 787 583 935 680 939'} />
      <circle className="onboarding-idle-endpoint" cx={expired ? mobile ? 460 : 605 : mobile ? 453 : 680} cy={expired ? mobile ? 860 : 825 : mobile ? 818 : 939} r="4" />
    </svg>
  </div>;
}
