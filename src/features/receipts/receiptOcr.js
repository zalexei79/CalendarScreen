// Loaded only after photo selection and a successful entitlement check.
import {refineReceiptMath} from './receiptOcrMath.js';
import {parseReceiptPhoto,photoAmount} from './receiptPhoto.js';
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
    let { data } = await Promise.race([worker.recognize(file,{}, {blocks:true}), failure]);
    refining = true;
    const initial=parseReceiptPhoto(data);
    // Automatic layout can lose the final line of a dense receipt. Try a single
    // text block before treating a receipt as an unstructured amount photo.
    if(!initial.total&&!initial.ambiguousTotal){
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      const block=await Promise.race([worker.recognize(file,{}, {blocks:true}),failure]);
      const parsed=parseReceiptPhoto(block.data);
      if(parsed.kind==='receipt'){
        if(initial.kind!=='receipt'||parsed.total)data=block.data;
      }
    }
    if(parseReceiptPhoto(data).kind==='amount'){
      if(!photoAmount(data).total){
        await worker.setParameters({tessedit_pageseg_mode:'11'});
        const sparse=await Promise.race([worker.recognize(file,{}, {blocks:true}),failure]);
        if(photoAmount(sparse.data).total)data=sparse.data;
      }
      onProgress?.(100);return {text:data.text,blocks:data.blocks};
    }
    const text = await refineReceiptMath(data,async(rectangle,mode)=>{
      await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789.,xXх×*@=: '});
      const result=await Promise.race([worker.recognize(file,{rectangle}),failure]);
      return result.data.text;
    },{signal,onProgress});
    onProgress?.(100);
    return {text,blocks:data.blocks};
  } finally {
    clearTimeout(timeout); clearTimeout(deadline); finished = true;
    signal?.removeEventListener('abort', cancel); signal?.removeEventListener('abort', abortFailure);
    if (worker) await worker.terminate().catch(() => {});
  }
}
