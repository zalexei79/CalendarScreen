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

function drawFlameSticker(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(255,126,54,.28)'; ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(0, 92); ctx.bezierCurveTo(-54, 70, -58, 16, -13, -5);
  ctx.bezierCurveTo(-20, 31, 2, 38, 13, 8);
  ctx.bezierCurveTo(31, -30, 47, -49, 40, -77);
  ctx.bezierCurveTo(90, -35, 91, 28, 61, 65);
  ctx.bezierCurveTo(45, 86, 25, 94, 0, 92); ctx.closePath();
  ctx.fillStyle = '#ff873d'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(10, 76); ctx.bezierCurveTo(-18, 57, -14, 28, 10, 13);
  ctx.bezierCurveTo(10, 35, 25, 37, 32, 18); ctx.bezierCurveTo(54, 48, 38, 72, 10, 76); ctx.fillStyle = '#ffd34e'; ctx.fill();
  ctx.fillStyle = '#3b245c'; ctx.beginPath(); ctx.arc(10, 44, 5, 0, Math.PI * 2); ctx.arc(38, 39, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3b245c'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(24, 49, 12, .2, Math.PI - .2); ctx.stroke();
  ctx.restore();
}

function drawConfetti(ctx) {
  const pieces = [[116,228,18,'#ffcf4a'],[176,292,12,'#56d6c9'],[900,242,16,'#ff8a69'],[946,336,10,'#fff'],[126,560,13,'#a78bfa'],[914,532,18,'#ffd34e'],[244,590,9,'#ff91c8'],[816,584,11,'#56d6c9']];
  pieces.forEach(([x,y,size,color], index) => { ctx.save(); ctx.translate(x,y); ctx.rotate(index * .43); ctx.fillStyle=color; ctx.roundRect(-size/2,-size/2,size,size*.55,4); ctx.fill(); ctx.restore(); });
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
    share: t('streakShare'), save: t('streakSavePhoto'), close: t('streakClose'), preparing: t('streakPreparing'),
    inviteTitle: t('streakInviteTitle'), inviteBody: t('streakInviteBody'), inviteHint: t('streakInviteHint'), proBadge: t('streakProBadge'),
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

  function makePhotoFile() {
    if (!shareBlob) return null;
    return new File([shareBlob], `dayris-streak-${days}.png`, { type: 'image/png' });
  }

  function isAppleTouchDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  async function savePhoto() {
    if (!shareBlob) return;
    const file = makePhotoFile();
    // iOS does not let a PWA write directly into Photos. Opening the native
    // share sheet with only the image exposes "Save Image" instead of Files.
    if (file && isAppleTouchDevice() && navigator.share
      && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ title: copy.title, files: [file] }); } catch (error) {
        if (error?.name !== 'AbortError') console.error('Streak photo save error:', error);
      }
      return;
    }
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
    const file = makePhotoFile();
    const code = shareCode;
    const url = new URL('/?install=1', window.location.origin);
    if (code) url.searchParams.set('ref', code);
    try {
      if (navigator.share && file && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: copy.title, text: copy.shareText.replace('{0}', String(days)), url: url.toString(), files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: copy.title, text: copy.shareText.replace('{0}', String(days)), url: url.toString() });
      } else {
        try { await navigator.clipboard.writeText(url.toString()); } catch { /* download remains available */ }
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(url.toString()); } catch { /* keep the dialog open */ }
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
          <button type="button" onClick={savePhoto} disabled={busy || !shareBlob} className="activity-streak-secondary"><Download size={16} />{copy.save}</button>
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
  const main = '#30215a';
  const muted = '#655d82';
  const amber = '#ffb52e';
  const panel = '#ffffff';
  const border = '#eadff5';
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#fff8df');
  gradient.addColorStop(.48, '#f3eaff');
  gradient.addColorStop(1, '#dff9f6');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
  drawConfetti(ctx);
  drawBrandIcon(ctx, brandIcon, 72, 68, 86);
  ctx.fillStyle = main; ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('DAYRIS', 180, 113);
  ctx.fillStyle = amber; ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('STREAK', 180, 146);
  roundedRect(ctx, 786, 77, 222, 54, 27); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#7c3aed'; ctx.font = '800 18px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText('MY STREAK', 897, 111);
  ctx.textAlign = 'left';

  // Hero: a clean, shareable focus on the achievement — no private account data.
  roundedRect(ctx, 72, 196, 936, 438, 42);
  const hero = ctx.createLinearGradient(72, 196, 1008, 634); hero.addColorStop(0, '#7048d8'); hero.addColorStop(.52, '#9b55d8'); hero.addColorStop(1, '#2ab8b0');
  ctx.fillStyle = hero; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.stroke();
  drawFlameSticker(ctx, 540, 286, 1.02);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = '900 190px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(String(days), 540, 468);
  ctx.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.title, 540, 526);
  ctx.fillStyle = '#fdf7ff'; ctx.font = '600 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(paused ? copy.paused : copy.active, 540, 570);
  ctx.textAlign = 'left';

  roundedRect(ctx, 72, 680, 936, 450, 38); ctx.fillStyle = panel; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = amber; ctx.font = '800 35px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.inviteTitle, 116, 750);
  ctx.fillStyle = main; ctx.font = '800 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.proBadge, 116, 800);
  roundedRect(ctx, 112, 844, 282, 244, 24); ctx.fillStyle = '#fff'; ctx.fill();
  const inviteUrl = new URL('/?install=1', window.location.origin); if (code) inviteUrl.searchParams.set('ref', code);
  drawQrToCanvas(ctx, createQrMatrix(inviteUrl.toString()), 134, 856, 238, { foreground: '#09090b', background: '#fff' });
  ctx.fillStyle = muted; ctx.font = '500 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteBody, 466, 870, 470, 34, 4);
  ctx.fillStyle = main; ctx.font = '700 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteHint, 466, 1030, 470, 32, 3);
  ctx.fillStyle = amber; roundedRect(ctx, 72, 1272, 72, 5, 3); ctx.fill();
  ctx.fillStyle = muted; ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('© DAYRIS', 160, 1281);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('IMAGE_EXPORT_FAILED')), 'image/png', .96));
}
