// Loaded only after photo selection and a successful entitlement check.
import {refineReceiptMath} from './receiptOcrMath.js';
export async function recognizeReceipt(file, { language = 'ru', onProgress, signal } = {}) {
  const { createWorker } = await import('tesseract.js');
  const { default: workerPath } = await import('tesseract.js/dist/worker.min.js?url');
  if (signal?.aborted) throw new Error('CANCELLED');
  let worker;
  let finished = false;
  let refining = false;
  const cancel = () => { finished = true; worker?.terminate().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 120000);
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  const abortFailure = () => rejectFailure(new Error('CANCELLED'));
  signal?.addEventListener('abort', abortFailure, { once: true });
  const deadline = setTimeout(() => rejectFailure(new Error('OCR_TIMEOUT')), 120000);
  try {
    const languages = String(language).startsWith('zh') ? ['eng','chi_sim'] : ['eng','ron','rus'];
    const creation = createWorker(languages, 1, { workerPath, corePath: new URL('/receipt-ocr/v1/',location.origin).href, langPath: new URL('/receipt-ocr/v1/lang/',location.origin).href, logger: message => { if (!finished && !refining) onProgress?.(message.status === 'recognizing text' ? 35 + Math.round(message.progress * 50) : Math.round((message.progress || 0) * 30)); }, errorHandler: () => rejectFailure(new Error('OCR_FAILED')) });
    creation.then(created => { worker = created; if (finished) created.terminate().catch(() => {}); }, () => {});
    worker = await Promise.race([creation, failure]);
    if (finished || signal?.aborted) throw new Error('CANCELLED');
    // Automatic page segmentation retains wrapped rows and dates on skewed
    // receipts; treating the entire camera photo as one text block loses them.
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const { data } = await Promise.race([worker.recognize(file,{}, {blocks:true}), failure]);
    refining = true;
    const text = await refineReceiptMath(data,async(rectangle,mode)=>{
      await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789.,xXх×*=: '});
      const result=await Promise.race([worker.recognize(file,{rectangle}),failure]);
      return result.data.text;
    },{signal,onProgress});
    onProgress?.(100);
    return text;
  } finally {
    clearTimeout(timeout); clearTimeout(deadline); finished = true;
    signal?.removeEventListener('abort', cancel); signal?.removeEventListener('abort', abortFailure);
    if (worker) await worker.terminate().catch(() => {});
  }
}
