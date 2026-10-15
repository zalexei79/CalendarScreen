import React, { useEffect, useRef, useState } from 'react';
import { Download, Flame, RefreshCw, Share2, X } from 'lucide-react';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import { createQrMatrix, drawQrToCanvas } from '../../../qrCode.js';
import { drawBrandIcon, loadBrandIcon } from '../lib/brandIcon.js';
import './ActivityStreakDialog.css';

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight));
}

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
    title: t('streakModalTitle'), account: t('streakAccount'), active: t('streakStatusActive'), paused: t('streakStatusPaused'),
    share: t('streakShare'), save: t('streakSaveImage'), close: t('streakClose'), preparing: t('streakPreparing'),
    inviteTitle: t('streakInviteTitle'), inviteBody: t('streakInviteBody'), inviteHint: t('streakInviteHint'),
    shareText: t('streakShareText'), error: t('streakShareError'),
  };

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
        const blob = await createShareBlob({ days, account, paused: Boolean(streak.paused), code, isLight, copy });
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

  function download() {
    if (!shareBlob) return;
    const url = URL.createObjectURL(shareBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dayris-streak-${days}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function share() {
    if (!shareBlob) return;
    const file = new File([shareBlob], `dayris-streak-${days}.png`, { type: 'image/png' });
    const code = shareCode;
    const url = new URL('/?install=1', window.location.origin);
    if (code) url.searchParams.set('ref', code);
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: copy.title, text: copy.shareText.replace('{0}', String(days)), url: url.toString(), files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: copy.title, text: copy.shareText.replace('{0}', String(days)), url: url.toString() });
        download();
      } else {
        try { await navigator.clipboard.writeText(url.toString()); } catch { /* download remains available */ }
        download();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') download();
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
            <span>{t('streakDaysLong')}</span>
          </div>
          <div className="activity-streak-account">
            <span>{copy.account}</span>
            <strong>{account}</strong>
          </div>
          <p className={`activity-streak-status ${streak.paused ? 'is-paused' : ''}`}>
            <span className="activity-streak-status-dot" />{streak.paused ? copy.paused : copy.active}
          </p>
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
          <button type="button" onClick={download} disabled={busy || !shareBlob} className="activity-streak-secondary"><Download size={16} />{copy.save}</button>
          <button type="button" onClick={share} disabled={busy || !shareBlob} className="activity-streak-primary"><Share2 size={16} />{copy.share}</button>
        </div>
      </SwipeDismissSheet>
    </div>
  );
}

async function createShareBlob({ days, account, paused, code, isLight, copy }) {
  const brandIcon = await loadBrandIcon();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  const dark = !isLight;
  const main = dark ? '#f8fafc' : '#191b20';
  const muted = dark ? '#9aa2af' : '#6f7782';
  const amber = '#f5b91f';
  const panel = dark ? '#14171d' : '#ffffff';
  const border = dark ? '#2b3039' : '#e1e5e9';
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, dark ? '#08090b' : '#fffdf7');
  gradient.addColorStop(.7, dark ? '#0b0d11' : '#f7f8fa');
  gradient.addColorStop(1, dark ? '#171206' : '#fff4cb');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
  const glow = ctx.createRadialGradient(790, 340, 0, 790, 340, 490);
  glow.addColorStop(0, dark ? 'rgba(245,185,31,.22)' : 'rgba(245,185,31,.18)');
  glow.addColorStop(1, 'rgba(245,185,31,0)');
  ctx.fillStyle = glow; ctx.fillRect(320, 0, 760, 800);
  drawBrandIcon(ctx, brandIcon, 72, 68, 86);
  ctx.fillStyle = main; ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('DAYRIS', 180, 113);
  ctx.fillStyle = amber; ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.title.toUpperCase(), 180, 146);
  ctx.textAlign = 'center';
  ctx.fillStyle = amber; ctx.font = '900 230px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(String(days), 540, 450);
  ctx.fillStyle = main; ctx.font = '800 43px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.title, 540, 520);
  ctx.fillStyle = muted; ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(account, 540, 574);
  ctx.textAlign = 'left';
  roundedRect(ctx, 72, 640, 936, 174, 34); ctx.fillStyle = panel; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = paused ? muted : amber; ctx.font = '800 35px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(paused ? copy.paused : copy.active, 116, 710);
  ctx.fillStyle = muted; ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteBody, 116, 762, 820, 32, 2);
  roundedRect(ctx, 72, 866, 936, 340, 38); ctx.fillStyle = panel; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
  roundedRect(ctx, 112, 906, 260, 260, 24); ctx.fillStyle = '#fff'; ctx.fill();
  const inviteUrl = new URL('/?install=1', window.location.origin); if (code) inviteUrl.searchParams.set('ref', code);
  drawQrToCanvas(ctx, createQrMatrix(inviteUrl.toString()), 130, 924, 224, { foreground: '#09090b', background: '#fff' });
  ctx.fillStyle = main; ctx.font = '800 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteTitle, 430, 966, 510, 42, 3);
  ctx.fillStyle = muted; ctx.font = '500 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteHint, 430, 1100, 510, 32, 3);
  ctx.fillStyle = amber; roundedRect(ctx, 72, 1272, 72, 5, 3); ctx.fill();
  ctx.fillStyle = muted; ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('© DAYRIS', 160, 1281);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('IMAGE_EXPORT_FAILED')), 'image/png', .96));
}
