import { createQrMatrix, drawQrToCanvas } from '../../../qrCode.js';

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

const posterCopy = {
  ru: ['Каждый день имеет значение', '7 дней полного доступа'],
  en: ['Every day matters', '7 days of full access'],
  md: ['Fiecare zi contează', '7 zile de acces complet'],
  'zh-CN': ['每一天都有意义', '7 天完整体验'],
};

export async function createStreakPoster({ days, paused, copy, language, inviteUrl, dayLabel }) {
  const background = await loadBackground();
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.drawImage(background, 0, 0, 1080, 1350);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf7ff';
  fitText(ctx, 'D A Y R I S', 540, 51, 500, 30);
  ctx.fillStyle = '#ffda91';
  fitText(ctx, copy.cardHeadline, 540, 426, 700, 30);

  // Draw the actual count, without padding. Fit even multi-year streaks.
  const number = String(Math.max(1, Number(days) || 1));
  const gold = ctx.createLinearGradient(300, 460, 760, 740);
  gold.addColorStop(0, '#fff9e6'); gold.addColorStop(.42, '#ffe4a3');
  gold.addColorStop(.72, '#ffc56a'); gold.addColorStop(1, '#a6edff');
  ctx.fillStyle = gold; ctx.shadowColor = 'rgba(255,176,64,.55)'; ctx.shadowBlur = 24;
  fitText(ctx, number, 540, 715, 760, 330, 'Georgia, "Times New Roman", serif', '700');
  ctx.shadowBlur = 0;
  const [motto, trial] = posterCopy[language === 'ro' ? 'md' : language] || posterCopy.en;
  ctx.fillStyle = '#f1f5fb';
  fitText(ctx, copy.proudLine.replace('{0}', dayLabel), 540, 775, 920, 36);
  ctx.fillStyle = '#ffda91';
  fitText(ctx, paused ? copy.paused : motto, 540, 821, 900, 24);

  // A compact, opaque invitation keeps the QR legible on the textured art.
  ctx.beginPath(); ctx.roundRect(110, 1170, 860, 152, 28);
  ctx.fillStyle = '#071524'; ctx.fill();
  const rim = ctx.createLinearGradient(110, 0, 970, 0);
  rim.addColorStop(0, '#365c53'); rim.addColorStop(1, '#364351');
  ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.fillStyle = '#f1f5fb';
  fitText(ctx, copy.proBadge, 150, 1232, 590, 31, 'Arial, sans-serif', '600');
  ctx.fillStyle = '#abbecf';
  fitText(ctx, trial, 150, 1275, 590, 25);
  drawQrToCanvas(ctx, createQrMatrix(inviteUrl), 798, 1182, 128,
    { foreground: '#09090b', background: '#fff' });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob)
    : reject(new Error('IMAGE_EXPORT_FAILED')), 'image/png'));
}
