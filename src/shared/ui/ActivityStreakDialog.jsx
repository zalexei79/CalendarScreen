import React, { useEffect, useRef, useState } from 'react';
import { Flame, RefreshCw, Share2, X } from 'lucide-react';
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
  ctx.shadowColor = 'rgba(88,242,255,.7)'; ctx.shadowBlur = 32;
  ctx.beginPath();
  ctx.moveTo(0, 92); ctx.bezierCurveTo(-54, 70, -58, 16, -13, -5);
  ctx.bezierCurveTo(-20, 31, 2, 38, 13, 8);
  ctx.bezierCurveTo(31, -30, 47, -49, 40, -77);
  ctx.bezierCurveTo(90, -35, 91, 28, 61, 65);
  ctx.bezierCurveTo(45, 86, 25, 94, 0, 92); ctx.closePath();
  ctx.fillStyle = '#67efff'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(10, 76); ctx.bezierCurveTo(-18, 57, -14, 28, 10, 13);
  ctx.bezierCurveTo(10, 35, 25, 37, 32, 18); ctx.bezierCurveTo(54, 48, 38, 72, 10, 76); ctx.fillStyle = '#ffb84d'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(17, 31, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawConfetti(ctx) {
  const pieces = [[116,228,18,'#ffb84d'],[176,292,12,'#67efff'],[900,242,16,'#a78bfa'],[946,336,10,'#e8fbff'],[126,560,13,'#a78bfa'],[914,532,18,'#ffb84d'],[244,590,9,'#67efff'],[816,584,11,'#a78bfa']];
  pieces.forEach(([x,y,size,color], index) => { ctx.save(); ctx.translate(x,y); ctx.rotate(index * .43); ctx.fillStyle=color; ctx.globalAlpha=.75; ctx.fillRect(-size/2,-size/2,size,2); ctx.fillRect(-1,-size/2,2,size); ctx.restore(); });
}

function drawTechGrid(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(112,190,220,.065)'; ctx.lineWidth = 1;
  for (let x = 0; x <= 1080; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1350); ctx.stroke(); }
  for (let y = 0; y <= 1350; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke(); }
  ctx.restore();
}

function drawDisplayNumber(ctx, value, x, y) {
  const display = String(value).padStart(2, '0');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '900 265px "Arial Black", "SFMono-Regular", ui-monospace, monospace';
  ctx.shadowColor = 'rgba(103,239,255,.5)'; ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(103,239,255,.18)'; ctx.fillText(display, x + 5, y + 4);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(103,239,255,.65)'; ctx.strokeText(display, x, y);
  const numberGradient = ctx.createLinearGradient(x, y - 240, x, y + 20);
  numberGradient.addColorStop(0, '#ffffff'); numberGradient.addColorStop(.48, '#dffaff'); numberGradient.addColorStop(1, '#ffb84d');
  ctx.fillStyle = numberGradient; ctx.fillText(display, x, y);
  ctx.restore();
}

function localizedDayCount(days, language) {
  const value = Number(days);
  if (String(language).toLowerCase().startsWith('zh')) return `${value} 天`;
  if (language === 'en') return `${value} ${value === 1 ? 'day' : 'days'}`;
  if (language === 'md' || language === 'ro') return `${value} ${value === 1 ? 'zi' : 'zile'}`;
  if (value % 100 >= 11 && value % 100 <= 14) return `${value} дней`;
  if (value % 10 === 1) return `${value} день`;
  if (value % 10 >= 2 && value % 10 <= 4) return `${value} дня`;
  return `${value} дней`;
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
    title: t('streakModalTitle'), cardHeadline: t('streakCardHeadline'), proudLine: t('streakProudLine'), account: t('streakAccount'), active: t('streakStatusActive'), paused: t('streakStatusPaused'),
    share: t('streakSharePhoto'), close: t('streakClose'), preparing: t('streakPreparing'),
    inviteTitle: t('streakInviteTitle'), inviteBody: t('streakInviteBody'), inviteHint: t('streakInviteHint'), proBadge: t('streakProBadge'),
    shareText: t('streakShareText'), error: t('streakShareError'),
  };
  const formatCountText = (template) => template.replace('{0}', localizedDayCount(days, language));

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
    try {
      if (navigator.share && file && isAppleTouchDevice()) {
        // WebKit can reject a payload containing both `url` and `files`.
        // Put the URL in the caption so iOS keeps the image and the link together.
        try {
          await navigator.share({ title: copy.title, text: `${shareText}\n${url.toString()}`, files: [file] });
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
          <button type="button" onClick={share} disabled={busy || !shareBlob} className="activity-streak-primary"><Share2 size={19} />{copy.share}</button>
        </div>
      </SwipeDismissSheet>
    </div>
  );
}

async function createShareBlob({ days, account, paused, code, isLight, copy, language }) {
  const brandIcon = await loadBrandIcon();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  const main = '#e8f7ff';
  const muted = '#8da4b9';
  const amber = '#ffb84d';
  const cyan = '#67efff';
  const panel = '#101b2a';
  const border = 'rgba(116,220,240,.25)';
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#050b14');
  gradient.addColorStop(.48, '#0a1422');
  gradient.addColorStop(1, '#17102b');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
  drawTechGrid(ctx);
  const cyanGlow = ctx.createRadialGradient(160, 240, 0, 160, 240, 330); cyanGlow.addColorStop(0, 'rgba(103,239,255,.12)'); cyanGlow.addColorStop(1, 'rgba(103,239,255,0)'); ctx.fillStyle = cyanGlow; ctx.fillRect(0, 0, 480, 520);
  const violetGlow = ctx.createRadialGradient(900, 760, 0, 900, 760, 380); violetGlow.addColorStop(0, 'rgba(167,139,250,.11)'); violetGlow.addColorStop(1, 'rgba(167,139,250,0)'); ctx.fillStyle = violetGlow; ctx.fillRect(560, 420, 520, 560);
  drawConfetti(ctx);
  drawBrandIcon(ctx, brandIcon, 72, 68, 86);
  ctx.fillStyle = main; ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('DAYRIS', 180, 113);
  ctx.fillStyle = amber; ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('MY STREAK', 180, 146);
  roundedRect(ctx, 786, 77, 222, 54, 27); ctx.fillStyle = 'rgba(103,239,255,.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(103,239,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = cyan; ctx.font = '800 17px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textAlign = 'center'; ctx.fillText(`${String(days).padStart(3, '0')} DAYS`, 897, 111);
  ctx.textAlign = 'left';

  // Hero: a clean, shareable focus on the achievement — no private account data.
  roundedRect(ctx, 64, 196, 952, 654, 44);
  const hero = ctx.createLinearGradient(64, 196, 1016, 850); hero.addColorStop(0, '#111f34'); hero.addColorStop(.56, '#162943'); hero.addColorStop(1, '#211737');
  ctx.fillStyle = hero; ctx.fill(); ctx.strokeStyle = 'rgba(103,239,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(103,239,255,.7)'; ctx.fillRect(112, 234, 62, 3); ctx.fillStyle = 'rgba(255,184,77,.8)'; ctx.fillRect(182, 234, 24, 3);
  ctx.fillStyle = cyan; ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textAlign = 'left'; ctx.fillText('DAILY MOMENTUM', 112, 282);
  drawFlameSticker(ctx, 540, 308, .86);
  ctx.beginPath(); ctx.arc(540, 462, 212, -.85, Math.PI * 1.28); ctx.strokeStyle = 'rgba(103,239,255,.15)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(540, 462, 212, 2.1, Math.PI * 1.72); ctx.strokeStyle = amber; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
  ctx.textAlign = 'center';
  drawDisplayNumber(ctx, days, 540, 568);
  ctx.font = '800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.cardHeadline, 540, 654);
  ctx.fillStyle = cyan; ctx.font = '600 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.proudLine.replace('{0}', localizedDayCount(days, language)), 540, 704);
  ctx.fillStyle = paused ? muted : amber; ctx.font = '600 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(paused ? copy.paused : copy.active, 540, 760);
  ctx.textAlign = 'left';

  roundedRect(ctx, 64, 892, 952, 306, 36); ctx.fillStyle = 'rgba(16,27,42,.94)'; ctx.fill(); ctx.strokeStyle = border; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = amber; ctx.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.proBadge, 112, 968);
  ctx.fillStyle = main; ctx.font = '800 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText(copy.inviteTitle, 112, 1022);
  ctx.fillStyle = muted; ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; wrapText(ctx, copy.inviteBody, 112, 1070, 470, 31, 2);
  roundedRect(ctx, 774, 930, 190, 226, 22); ctx.fillStyle = '#f7fbff'; ctx.fill(); ctx.strokeStyle = 'rgba(103,239,255,.5)'; ctx.lineWidth = 2; ctx.stroke();
  const inviteUrl = new URL('/?install=1', window.location.origin); if (code) inviteUrl.searchParams.set('ref', code);
  drawQrToCanvas(ctx, createQrMatrix(inviteUrl.toString()), 789, 945, 160, { foreground: '#09090b', background: '#fff' });
  ctx.fillStyle = cyan; ctx.font = '600 16px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.fillText('SCAN // JOIN', 112, 1150);
  ctx.fillStyle = amber; roundedRect(ctx, 64, 1260, 72, 5, 3); ctx.fill();
  ctx.fillStyle = muted; ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'; ctx.fillText('DAYRIS / EVERY DAY MATTERS', 152, 1270);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('IMAGE_EXPORT_FAILED')), 'image/png', .96));
}
