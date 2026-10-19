import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const target = new URL('../public/receipt-ocr/v1/', import.meta.url);
await fs.mkdir(new URL('lang/', target), { recursive: true });
const core = path.dirname(require.resolve('tesseract.js-core/package.json'));
for (const name of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','LICENSE']) await fs.copyFile(path.join(core,name),new URL(name,target));
for (const language of ['eng','ron','rus','chi_sim']) {
  const root = path.dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
  await fs.copyFile(path.join(root,`4.0.0_best_int/${language}.traineddata.gz`),new URL(`lang/${language}.traineddata.gz`,target));
}
console.log('Receipt OCR: local engine and four language packs prepared.');
