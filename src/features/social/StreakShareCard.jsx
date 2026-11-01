import React from 'react';
import {Flame} from 'lucide-react';
import {streakDayLabel} from '../../shared/i18n/streak.js';
import {momentShareCopy} from './momentShareCopy.js';
import './SocialShare.css';
export default function StreakShareCard({data,language}){
 const t=momentShareCopy(language),label=streakDayLabel(data.days,language),unit=label.replace(String(data.days),'').trim();
 return <article className="social-moment-card social-streak-card" aria-label={label}>
  <header><span>DAYRIS</span><span>{t.streakTag}</span></header>
  <div className="social-streak-art" aria-hidden="true"><span className="social-streak-halo"/><Flame className="social-streak-flame" strokeWidth={1.25}/></div>
  <div className="social-streak-number"><strong>{data.days}</strong><span>{unit}</span></div>
  <p className="social-moment-caption">{t.rhythm}</p>
  <footer><span className="social-moment-seal"/>{data.paused?t.streakPaused:t.streakActive}</footer>
 </article>;
}
