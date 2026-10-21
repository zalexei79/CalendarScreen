import React, { useEffect, useRef, useState } from 'react';
import { Flame, Pause, Clock3, RotateCcw, RefreshCw, Share2, X } from 'lucide-react';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import { createStreakPoster } from '../lib/streakPoster.js';
import { streakDayLabel } from '../i18n/streak.js';
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
  const [shareBlob, setShareBlob] = useState(null);
  const [shareError, setShareError] = useState('');
  const blobUrlRef = useRef('');

  const days = Math.max(1, Number(streak?.currentStreak) || 1);
  const account = accountName(user);
  const activeCode = referralCode || '';
  const [shareCode, setShareCode] = useState(activeCode);
  const copy = {
    title: t('streakModalTitle'), cardHeadline: t('streakCardHeadline'), proudLine: t('streakProudLine'), account: t('streakAccount'), active: t('streakStatusActive'), paused: t('streakStatusPaused'),
    share: t('streakSharePhoto'), close: t('streakClose'), preparing: t('streakPreparing'),
    inviteTitle: t('streakInviteTitle'), inviteBody: t('streakInviteBody'), inviteHint: t('streakInviteHint'), proBadge: t('streakProBadge'),
    shareText: t('streakShareText'), error: t('streakShareError'),
    runUnit: t('streakRunUnit'), grace: t('streakPosterGrace'), reset: t('streakPosterReset'),
  };
  const formatCountText = (template) => template.replace('{0}', streakDayLabel(days, language));

  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  useEffect(() => {
    if (!open || !streak) return undefined;
    let cancelled = false;
    setBusy(true);
    setShareError('');

    async function prepare() {
      const code = activeCode || await ensureReferralCode?.();
      if (!cancelled) setShareCode(code || '');
      try {
        const blob = await createShareBlob({ days, account, paused: Boolean(streak.paused), code, isLight, copy, language });
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setShareBlob(blob);
        setPreviewUrl(url);
      } catch (error) {
        if (!cancelled) setShareError(error?.message || copy.error);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    prepare();
    return () => { cancelled = true; };
  // The dialog is intentionally regenerated when the visible streak/account changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, streak, isLight, language]);

  if (!open) return null;

  function makePhotoFile() {
    if (!shareBlob) return null;
    return new File([shareBlob], `dayris-streak-${days}.png`, { type: 'image/png' });
  }

  function isAppleTouchDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  async function share() {
    if (!shareBlob) return;
    const file = makePhotoFile();
    const code = shareCode;
    const url = new URL('/?install=1', window.location.origin);
    if (code) url.searchParams.set('ref', code);
    const shareText = formatCountText(copy.shareText);
    const caption = `${shareText} ${url.toString()}`;
    try {
      if (navigator.share && file && isAppleTouchDevice()) {
        // WebKit can reject a payload containing both `url` and `files`.
        // Put the URL in the caption so iOS keeps the image and the link together.
        try {
          await navigator.share({ title: copy.title, text: caption, files: [file] });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
          // Fall through to the URL-only fallback if this WebKit build cannot share files.
        }
      }
      if (navigator.share && file && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: copy.title, text: shareText, url: url.toString(), files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: copy.title, text: shareText, url: url.toString() });
      } else {
        try { await navigator.clipboard.writeText(caption); } catch { /* keep the dialog open */ }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(caption); } catch { /* keep the dialog open */ }
      }
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
          <section className="activity-streak-rules" aria-labelledby="streak-rules-title">
            <h3 id="streak-rules-title">{t('streakRulesTitle')}</h3>
            <p>{t('streakRulesIntro')}</p>
            <ol className="activity-streak-rule-steps">
              <li><Pause aria-hidden="true" size={18} /><span>{t('streakRulePauseDay')}</span><strong>{t('streakRulePause')}</strong></li>
              <li><Clock3 aria-hidden="true" size={18} /><span>{t('streakRuleRescueDay')}</span><strong>{t('streakRuleRescue')}</strong></li>
              <li><RotateCcw aria-hidden="true" size={18} /><span>{t('streakRuleResetDay')}</span><strong>{t('streakRuleReset')}</strong></li>
            </ol>
            <p>{t('streakRulesDetail')}</p>
          </section>
          <div className="activity-streak-invite">
            <div className="activity-streak-invite-flame"><Flame size={17} /></div>
            <div><strong>{copy.inviteTitle}</strong><p>{copy.inviteBody}</p></div>
          </div>
          {busy && <div className="activity-streak-preparing"><RefreshCw size={16} className="animate-spin" />{copy.preparing}</div>}
          {shareError && <p className="activity-streak-error">{shareError}</p>}
          {previewUrl && <img className="activity-streak-preview" src={previewUrl} alt={copy.title} />}
          <p className="activity-streak-hint">{copy.inviteHint}</p>
        </div>

        <div className="activity-streak-actions">
          <button type="button" onClick={share} disabled={busy || !shareBlob} className="activity-streak-primary"><Share2 size={19} />{copy.share}</button>
        </div>
      </SwipeDismissSheet>
    </div>
  );
}

async function createShareBlob({ days, paused, code, copy, language }) {
  const inviteUrl = new URL('/?install=1', window.location.origin);
  if (code) inviteUrl.searchParams.set('ref', code);
  return createStreakPoster({ days, paused, copy, language, inviteUrl: inviteUrl.toString(), dayLabel: streakDayLabel(days, language) });
}
