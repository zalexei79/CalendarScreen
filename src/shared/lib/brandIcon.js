import { APP_SHARE_ICON } from '../config/brand.js';

let imagePromise;

export function loadBrandIcon() {
  if (!imagePromise) {
    imagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => fail(), 10000);
      function fail() {
        clearTimeout(timeout);
        image.onload = image.onerror = null;
        reject(new Error('BRAND_ICON_LOAD_FAILED'));
      }
      image.onload = () => {
        clearTimeout(timeout);
        resolve(image);
      };
      image.onerror = fail;
      image.src = APP_SHARE_ICON;
    }).catch((error) => {
      imagePromise = undefined;
      throw error;
    });
  }
  return imagePromise;
}

export function drawBrandIcon(ctx, image, x, y, size) {
  ctx.save();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}
