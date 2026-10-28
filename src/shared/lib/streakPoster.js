import { createQrMatrix, drawQrToCanvas } from '../../../qrCode.js';
import { streakCopy, streakDayLabel } from '../i18n/streak.js';

const backgroundUrl = '/images/streak/momentum-glass-v1.webp';
let backgroundPromise;

function loadBackground() {
  if (!backgroundPromise) backgroundPromise = new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('STREAK_BACKGROUND_TIMEOUT')), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('STREAK_BACKGROUND_FAILED')); };
    image.src = backgroundUrl;
  }).catch(error => { backgroundPromise = undefined; throw error; });
  return backgroundPromise;
}

function fitText(ctx, text, x, y, width, size, family = 'Arial, sans-serif', weight = '500') {
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > width && size > 14) {
    ctx.font = `${weight} ${--size}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

// Safari's Georgia digits can extend below the alphabetic baseline. Place the
// actual ink bounds inside a fixed box instead of assuming baseline = bottom.
function drawTextBox(ctx, text, box, size, family = 'Arial, sans-serif', weight = '500') {
  let metrics;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    metrics = ctx.measureText(text);
    if (metrics.width <= box.width && metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent <= box.height) break;
    size -= 1;
  } while (size > 14);
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const baseline = box.y + (box.height - ascent - descent) / 2 + ascent;
  ctx.fillText(text, ctx.textAlign === 'left' ? box.x : box.x + box.width / 2, baseline);
}

export async function createStreakPoster({ days, paused, copy, language, inviteUrl, dayLabel }) {
  const background = await loadBackground();
  await document.fonts?.ready;
  const locale = String(language).startsWith('zh') ? 'zh-CN' : language === 'ro' ? 'md' : language;
  const labels = { ...(streakCopy[locale] || streakCopy.en) };
  dayLabel ||= streakDayLabel(days, language);
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.drawImage(background, 0, 0, 1080, 1350);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf7ff';
  fitText(ctx, 'D A Y R I S', 540, 51, 500, 30);
  ctx.fillStyle = '#ffda91';
  fitText(ctx, labels.streakCardHeadline, 540, 447, 760, 28);

  // Draw the actual count, without padding. Fit even multi-year streaks.
  const number = String(Math.max(0, Number(days) || 0));
  const gold = ctx.createLinearGradient(300, 500, 760, 710);
  gold.addColorStop(0, '#fff9e6'); gold.addColorStop(.42, '#ffe4a3');
  gold.addColorStop(.72, '#ffc56a'); gold.addColorStop(1, '#a6edff');
  ctx.fillStyle = gold; ctx.shadowColor = 'rgba(255,176,64,.32)'; ctx.shadowBlur = 12;
  drawTextBox(ctx, number, { x: 160, y: 500, width: 760, height: 210 }, 320, 'Georgia, "Times New Roman", serif', '700');
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f1f5fb';
  drawTextBox(ctx, labels.streakRunUnit.replace('{0}', dayLabel.replace(/^\d+\s*/, '')), { x: 140, y: 740, width: 800, height: 42 }, 38, 'Arial, sans-serif', '700');
  ctx.fillStyle = '#c5d4e3';
  drawTextBox(ctx, labels.streakProudLine, { x: 200, y: 796, width: 680, height: 28 }, 27);

  // A compact, opaque invitation keeps the QR legible on the textured art.
  ctx.beginPath(); ctx.roundRect(110, 1170, 860, 152, 28);
  ctx.fillStyle = '#071524'; ctx.fill();
  const rim = ctx.createLinearGradient(110, 0, 970, 0);
  rim.addColorStop(0, '#365c53'); rim.addColorStop(1, '#364351');
  ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#f1f5fb';
  drawTextBox(ctx, copy.proBadge, { x: 150, y: 1197, width: 590, height: 34 }, 31, 'Arial, sans-serif', '600');
  ctx.fillStyle = '#abbecf';
  drawTextBox(ctx, paused ? labels.streakStatusPaused : labels.streakPosterGrace, { x: 150, y: 1242, width: 590, height: 22 }, 21);
  drawTextBox(ctx, labels.streakPosterReset, { x: 150, y: 1277, width: 590, height: 22 }, 21);
  drawQrToCanvas(ctx, createQrMatrix(inviteUrl), 798, 1182, 128,
    { foreground: '#09090b', background: '#fff' });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob)
    : reject(new Error('IMAGE_EXPORT_FAILED')), 'image/png'));
}
