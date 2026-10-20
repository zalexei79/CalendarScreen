// Loaded only after photo selection and a successful entitlement check.
import {refineReceiptMath} from './receiptOcrMath.js';
import {parseReceiptPhoto,photoAmount} from './receiptPhoto.js';
import {receiptSignature,receiptDocumentIssue,receiptTotalAnchor} from './receiptStructure.js';
import {refineReceiptTotals,locateReceiptTotal} from './receiptOcrTotal.js';
import {receiptPaperImage,receiptFooterImage} from './receiptOcrImage.js';
async function recoveryImage(file,data){
  let bitmap;
  try{
    const heights=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>(paragraph.lines||[]).flatMap(line=>line.words||[]))).filter(word=>/\d/.test(word.text)).map(word=>word.bbox.y1-word.bbox.y0).sort((a,b)=>a-b);
    if(heights.length&&heights[Math.floor(heights.length/2)]>12)return file;
    bitmap=await createImageBitmap(file);
    const scale=Math.min(3,1000/bitmap.width,2400/bitmap.height);
    if(scale<1.3)return file;
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const context=canvas.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas;
  }catch{return file;}finally{bitmap?.close();}
}
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
    let input=file;
    let { data } = await Promise.race([worker.recognize(input,{}, {blocks:true}), failure]);
    refining = true;
    const initial=parseReceiptPhoto(data);
    // Automatic layout can lose the final line of a dense receipt. Try a single
    // text block before treating a receipt as an unstructured amount photo.
    if(!initial.total&&!initial.ambiguousTotal&&!initial.documentIssue){
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      const enlarged=await recoveryImage(file,data);
      const block=await Promise.race([worker.recognize(enlarged,{}, {blocks:true}),failure]);
      const parsed=parseReceiptPhoto(block.data);
      if(parsed.kind==='receipt'&&receiptSignature(block.data.text)){
        if(initial.kind!=='receipt'||parsed.total||block.data.text.split(/\r?\n/).some(receiptTotalAnchor)){data=block.data;input=enlarged;}
      }
    }
    const incomplete=parseReceiptPhoto(data);
    // A readable heading with unreadable digits still needs image recovery.
    // Item recognition and the mere presence of a total WORD cannot stop it.
    if(incomplete.kind==='receipt'&&!incomplete.total&&!incomplete.ambiguousTotal&&!incomplete.documentIssue){
      const paper=await receiptPaperImage(file);
      if(paper){
        await worker.setParameters({tessedit_pageseg_mode:'6'});
        const cropped=await Promise.race([worker.recognize(paper,{}, {blocks:true}),failure]);
        if(String(cropped.data.text||'').split(/\r?\n/).some(receiptTotalAnchor)){data={...cropped.data,totalRecovered:true};input=paper;}
        else{
          const footer=receiptFooterImage(paper);await worker.setParameters({tessedit_pageseg_mode:'11'});
          const band=await Promise.race([worker.recognize(footer,{}, {blocks:true}),failure]);
          const located=await locateReceiptTotal(band.data,async(rectangle,mode)=>{
            await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:''});
            const result=await Promise.race([worker.recognize(footer,{rectangle}),failure]);return result.data.text;
          },{signal});
          if(located){data=located;input=footer;}
        }
      }
    }
    if(parseReceiptPhoto(data).kind==='amount'&&!receiptDocumentIssue(String(data.text||'').split(/\r?\n/))){
      if(!photoAmount(data).total){
        await worker.setParameters({tessedit_pageseg_mode:'11'});
        const sparse=await Promise.race([worker.recognize(input,{}, {blocks:true}),failure]);
        if(parseReceiptPhoto(sparse.data).total||receiptSignature(sparse.data.text))data=sparse.data;
      }
      if(parseReceiptPhoto(data).kind==='amount'){onProgress?.(100);return {text:data.text,blocks:data.blocks};}
    }
    if(!receiptDocumentIssue(String(data.text||'').split(/\r?\n/)))data=await refineReceiptTotals(data,async(rectangle,mode)=>{
      await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789., '});
      const result=await Promise.race([worker.recognize(input,{rectangle}),failure]);return result.data.text;
    },{signal,onProgress});
    const text = await refineReceiptMath(data,async(rectangle,mode)=>{
      await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789.,xXх×*@=: '});
      const result=await Promise.race([worker.recognize(input,{rectangle}),failure]);
      return result.data.text;
    },{signal,onProgress});
    onProgress?.(100);
    return {text,blocks:data.blocks,totalNeedsReview:data.totalNeedsReview,totalRecovered:data.totalRecovered,totalLayout:data.totalLayout,totalCandidates:data.totalCandidates};
  } finally {
    clearTimeout(timeout); clearTimeout(deadline); finished = true;
    signal?.removeEventListener('abort', cancel); signal?.removeEventListener('abort', abortFailure);
    if (worker) await worker.terminate().catch(() => {});
  }
}
