import React, { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Clock3, RotateCcw, RefreshCw, Share2, Copy, Check, ChevronDown, X } from 'lucide-react';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import { createStreakPoster } from '../lib/streakPoster.js';
import { streakDayLabel } from '../i18n/streak.js';
import { streakReferralUrl, streakShareCaption } from '../lib/streakShare.js';
import { copyText } from '../lib/copyText.js';
import './ActivityStreakDialog.css';

function accountName(user) {
  return user?.email || user?.user_metadata?.preferred_username || user?.user_metadata?.name
    || user?.user_metadata?.full_name || 'DAYRIS';
}

export default function ActivityStreakDialog({
  open, streak, user, isLight, t, language, referralCode, ensureReferralCode, onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [preparedShare, setPreparedShare] = useState(null);
  const [shareError, setShareError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyAttemptRef = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [retry, setRetry] = useState(0);
  const sharingRef = useRef(false);
  const captionRef = useRef(null);
  const blobUrlRef = useRef('');

  const days = Math.max(1, Number(streak?.currentStreak) || 1);
  const account = accountName(user);
  const activeCode = referralCode || '';
  const owner = user?.id || user?.email || 'guest';
  const ready = Boolean(preparedShare && preparedShare.owner === owner && preparedShare.days === days
    && preparedShare.language === language && preparedShare.paused === Boolean(streak?.paused)
    && preparedShare.isLight === isLight && (!activeCode || preparedShare.code === activeCode.trim().toUpperCase()));
  const copy = {
    title: t('streakModalTitle'), cardHeadline: t('streakCardHeadline'), proudLine: t('streakProudLine'), account: t('streakAccount'), active: t('streakStatusActive'), paused: t('streakStatusPaused'),
    share: t('streakSharePhoto'), close: t('streakClose'), preparing: t('streakPreparing'),
    inviteTitle: t('streakInviteTitle'), inviteBody: t('streakInviteBody'), inviteHint: t('streakInviteHint'), proBadge: t('streakProBadge'),
    shareText: t('streakShareText'), error: t('streakShareError'),
    runUnit: t('streakRunUnit'), grace: t('streakPosterGrace'), reset: t('streakPosterReset'),
  };
  const caption = ready ? streakShareCaption(copy.shareText, streakDayLabel(days, language), preparedShare.url) : '';
  const copied = Boolean(ready && copyFeedback?.caption === caption);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timer = window.setTimeout(() => setCopyFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyFeedback]);

  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  useEffect(() => {
    if (!open || !streak) return undefined;
    let cancelled = false;
    setBusy(true);
    setShareError('');
    setShareNotice('');
    setCopyFeedback(null);
    copyAttemptRef.current += 1;
    setPreparedShare(null);
    setPreviewUrl('');

    async function prepare() {
      try {
        const code = String(activeCode || await ensureReferralCode?.() || '').trim().toUpperCase();
        if (cancelled) return;
        const referralUrl = streakReferralUrl(code, window.location.origin);
        const blob = await createStreakPoster({ days, paused: Boolean(streak.paused), copy, language,
          inviteUrl: referralUrl, dayLabel: streakDayLabel(days, language) });
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPreparedShare({ file: new File([blob], `dayris-streak-${days}.png`, { type: 'image/png' }),
          url: referralUrl, code, owner, days, language, paused: Boolean(streak.paused), isLight });
        setPreviewUrl(url);
      } catch (error) {
        if (!cancelled) setShareError(error?.message === 'STREAK_REFERRAL_UNAVAILABLE'
          ? t('streakReferralUnavailable') : copy.error);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    prepare();
    return () => { cancelled = true; };
  // The dialog is intentionally regenerated when the visible streak/account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, streak, isLight, language, owner, activeCode, ensureReferralCode, retry]);

  if (!open) return null;

  function isAppleTouchDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  async function share() {
    if (!ready || busy || sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setShareNotice('');
    const file = preparedShare.file;
    const url = preparedShare.url;
    const shareText = copy.shareText.replace('{0}', streakDayLabel(days, language));
    try {
      if (navigator.share && file && isAppleTouchDevice()) {
        // One iOS request, one text item with the referral URL, one photo.
        // The receiving extension can still ignore the caption. Do not retry
        // with another payload or report that the recipient received it.
        await navigator.share({ text: caption, files: [file] });
        setShareNotice(t('streakCaptionHint'));
      } else if (navigator.share && file && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: copy.title, text: shareText, url, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: copy.title, text: shareText, url });
      } else {
        await copyCaption();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setShareNotice(t('streakShareRetry'));
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }

  async function copyCaption() {
    if (!caption) return;
    const attempt = ++copyAttemptRef.current;
    setCopyFeedback(null);
    try {
      await copyText(caption, { container: captionRef.current || document.body, preferSelection: isAppleTouchDevice() });
      if (attempt !== copyAttemptRef.current) return;
      setShareNotice('');
      setCopyFeedback({ caption, id: attempt });
    } catch {
      if (attempt !== copyAttemptRef.current) return;
      setShareNotice(t('streakCaptionSelect'));
    }
  }

  return (
    <div className="activity-streak-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <SwipeDismissSheet onDismiss={onClose} isLight={isLight} className={`activity-streak-dialog ${isLight ? 'activity-streak-dialog-light' : ''}`}>
        <div className="activity-streak-dialog-head">
          <div>
            <p className="activity-streak-eyebrow">{copy.title}</p>
            <h2>{copy.title}</h2>
          </div>
          <button type="button" className="activity-streak-close" onClick={onClose} aria-label={copy.close}><X size={17} /></button>
        </div>

        <div className="activity-streak-dialog-body">
          <div className="activity-streak-hero" aria-live="polite">
            <div className="activity-streak-aura" />
            <Flame className="activity-streak-hero-flame" aria-hidden="true" />
            <strong>{days}</strong>
            <span>{copy.runUnit.replace('{0}', streakDayLabel(days, language).replace(/^\d+\s*/, ''))}</span>
            <p className="activity-streak-purpose">{copy.proudLine}</p>
          </div>
          <div className="activity-streak-account">
            <span>{copy.account}</span>
            <strong>{account}</strong>
          </div>
          <p className={`activity-streak-status ${streak.paused ? 'is-paused' : ''}`}>
            <span className="activity-streak-status-dot" />{streak.paused ? copy.paused : copy.active}
          </p>
          <details className="activity-streak-rules">
            <summary><span>{t('streakRulesTitle')}</span><ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="activity-streak-rules-content">
              <p>{t('streakRulesIntro')}</p>
              <ol className="activity-streak-rule-steps">
                <li><Pause aria-hidden="true" size={18} /><span>{t('streakRulePauseDay')}</span><strong>{t('streakRulePause')}</strong></li>
                <li><Clock3 aria-hidden="true" size={18} /><span>{t('streakRuleRescueDay')}</span><strong>{t('streakRuleRescue')}</strong></li>
                <li><RotateCcw aria-hidden="true" size={18} /><span>{t('streakRuleResetDay')}</span><strong>{t('streakRuleReset')}</strong></li>
              </ol>
              <p>{t('streakRulesDetail')}</p>
            </div>
          </details>
          <div className="activity-streak-invite">
            <div className="activity-streak-invite-flame"><Flame size={17} /></div>
            <div><strong>{copy.inviteTitle}</strong><p>{copy.inviteBody}</p></div>
          </div>
          {busy && <div className="activity-streak-preparing"><RefreshCw size={16} className="animate-spin" />{copy.preparing}</div>}
          {shareError && <div className="activity-streak-error"><p>{shareError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t('streakPrepareRetry')}</button></div>}
          {previewUrl && <img className="activity-streak-preview" src={previewUrl} alt={copy.title} />}
          <p className="activity-streak-hint">{copy.inviteHint}</p>
          {ready && <div className="activity-streak-caption" ref={captionRef}>
            <div><strong>{t('streakCaptionTitle')}</strong><button type="button" onClick={copyCaption} className={copied ? 'is-copied' : ''}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{t(copied ? 'streakCaptionCopyDone' : 'streakCaptionCopy')}</button></div>
            <p className="activity-streak-caption-text">{caption}</p>
            <p className="activity-streak-hint">{t('streakCaptionHint')}</p>
          </div>}
          {shareNotice && <p className="activity-streak-hint" role="status">{shareNotice}</p>}
        </div>

        {copied && <div key={copyFeedback.id} className="activity-streak-copy-toast" role="status" aria-live="polite" aria-atomic="true" aria-label={t('streakCaptionCopied')}>
          <Check size={16} strokeWidth={2.2} aria-hidden="true" />
          <span>{t('streakCaptionCopyDone')}</span>
        </div>}
        <div className="activity-streak-actions">
          <button type="button" onClick={share} disabled={busy || !ready || sharing} className="activity-streak-primary"><Share2 size={19} />{copy.share}</button>
        </div>
      </SwipeDismissSheet>
    </div>
  );
}
