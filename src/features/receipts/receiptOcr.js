import {createReceiptOcrBudget} from './receiptOcrBudget.js';
// Loaded only after photo selection and a successful entitlement check.
import {refineReceiptMath} from './receiptOcrMath.js';
import {parseReceiptPhoto,photoAmount} from './receiptPhoto.js';
import {receiptSignature,receiptDocumentIssue,receiptTotalAnchor} from './receiptStructure.js';
import {refineReceiptTotals} from './receiptOcrTotal.js';
import {receiptPaperImage,receiptFooterImage} from './receiptOcrImage.js';
import {recoverReceiptTotal} from './receiptTotalRecovery.js';
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
export async function recognizeReceipt(file, { language = 'ru', onProgress, onStage, signal } = {}) {
  const { createWorker } = await import('tesseract.js');
  const { default: workerPath } = await import('tesseract.js/dist/worker.min.js?url');
  if (signal?.aborted) throw new Error('CANCELLED');
  let worker;
  let finished = false;
  let refining = false,bestData=null,contextData=null,totalVerified=false,lastProgress=0;
  const progress=value=>{lastProgress=Math.max(lastProgress,Math.min(100,value));onProgress?.(lastProgress);};
  const contextual=result=>contextData&&contextData.text!==result.text?{...result,contextText:contextData.text,contextBlocks:contextData.blocks}:result;
  const stage=(name,value)=>{onStage?.(name);progress(value);};
  const cancel = () => { finished = true; worker?.terminate().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  const budget=createReceiptOcrBudget({signal,onTimeout:cancel});
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  const abortFailure = () => rejectFailure(new Error('CANCELLED'));
  signal?.addEventListener('abort', abortFailure, { once: true });
  const run=(operation,limit)=>budget.run(Promise.race([operation,failure]),limit);
  const languages=String(language).startsWith('zh')?['eng','chi_sim']:['eng','ron','rus'];let languageMode='full';
  const parameters=async(value,{numeric=false}={})=>{
    const next=numeric&&value.tessedit_pageseg_mode==='13'?'digits':'full';
    if(next!==languageMode&&typeof worker.reinitialize==='function'){await run(worker.reinitialize(next==='digits'?'eng':languages,1),6000);languageMode=next;}
    await run(worker.setParameters(value),4000);
  };
  try {
    stage('preparing',0);
    const creation = createWorker(languages, 1, { workerPath, corePath: new URL('/receipt-ocr/v1/',location.origin).href, langPath: new URL('/receipt-ocr/v1/lang/',location.origin).href, logger: message => { if (!finished && !refining) progress(message.status === 'recognizing text' ? 35 + Math.round(message.progress * 28) : Math.round((message.progress || 0) * 30)); }, errorHandler: () => rejectFailure(new Error('OCR_FAILED')) });
    creation.then(created => { worker = created; if (finished) created.terminate().catch(() => {}); }, () => {});
    worker = await run(creation,45000);
    if (finished || signal?.aborted) throw new Error('CANCELLED');
    // Automatic page segmentation retains wrapped rows and dates on skewed
    // receipts; treating the entire camera photo as one text block loses them.
    await parameters({ tessedit_pageseg_mode: '3' });
    stage('preparing',32);
    const prepared=await run(receiptPaperImage(file),8000);
    let input=prepared||file;stage('reading',35);
    let { data } = await run(worker.recognize(input,{}, {blocks:true}),25000);
    refining = true;bestData=data;contextData=data;stage('total',65);
    const initial=parseReceiptPhoto(data);
    // Automatic layout can lose the final line of a dense receipt. Try a single
    // text block before treating a receipt as an unstructured amount photo.
    if(!initial.total&&!initial.ambiguousTotal&&!initial.documentIssue){
      await parameters({tessedit_pageseg_mode:'6'});
      const enlarged=prepared?file:await run(recoveryImage(file,data),8000);
      const block=await run(worker.recognize(enlarged,{}, {blocks:true}),18000);
      const parsed=parseReceiptPhoto(block.data);
      if(parsed.kind==='receipt'){
        if(initial.kind!=='receipt'||parsed.total||block.data.text.split(/\r?\n/).some(receiptTotalAnchor)){data=block.data;bestData=data;input=enlarged;if(data.text.length>(contextData?.text.length||0))contextData=data;}
      }
    }
    const incomplete=parseReceiptPhoto(data);
    let totalRefined=false;
    // A readable heading with unreadable digits still needs image recovery.
    // Item recognition and the mere presence of a total WORD cannot stop it.
    if(!incomplete.total&&!incomplete.ambiguousTotal&&!incomplete.documentIssue){
      stage('total',72);
      const paper=prepared||await run(receiptPaperImage(file,{fallbackToWhole:true}),8000);
      if(paper){
        const footer=receiptFooterImage(paper);
        const recovered=await recoverReceiptTotal([{image:paper,mode:'6'},{image:footer,mode:'11'},{image:footer,mode:'3'},{image:footer,mode:'6'}],async(image,{mode,rectangle,numeric})=>{
          await parameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:numeric?'0123456789., ':''},{numeric});
          const result=await run(worker.recognize(image,rectangle?{rectangle}:{},{blocks:!rectangle}),rectangle?6000:14000);return result.data;
        },{signal,onProgress:progress});
        if(recovered){data={...recovered.data,totalRecoveredFromMissing:true};bestData=data;input=recovered.input;totalRefined=true;totalVerified=true;}
      }
    }
    if(parseReceiptPhoto(data).kind==='amount'&&!receiptDocumentIssue(String(data.text||'').split(/\r?\n/))){
      if(!photoAmount(data).total){
        await parameters({tessedit_pageseg_mode:'11'});
        const sparse=await run(worker.recognize(input,{}, {blocks:true}),12000);
        if(parseReceiptPhoto(sparse.data).total||receiptSignature(sparse.data.text))data=sparse.data;
      }
      if(parseReceiptPhoto(data).kind==='amount'){progress(100);return contextual({text:data.text,blocks:data.blocks});}
    }
    if(!totalRefined&&!receiptDocumentIssue(String(data.text||'').split(/\r?\n/)))data=await refineReceiptTotals(data,async(rectangle,mode)=>{
      await parameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789., '},{numeric:true});
      const result=await run(worker.recognize(input,{rectangle}),6000);return result.data.text;
    },{signal,onProgress:progress});
    bestData=data;totalVerified=true;stage('items',94);
    const text = data.totalRecovered||budget.remaining()<12000?data.text:await refineReceiptMath(data,async(rectangle,mode)=>{
      await parameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789.,xXх×*@=: '},{numeric:true});
      const result=await run(worker.recognize(input,{rectangle}),6000);
      return result.data.text;
    },{signal,onProgress:progress});
    progress(100);
    return contextual({text,blocks:data.blocks,totalNeedsReview:data.totalNeedsReview,totalRecovered:data.totalRecovered,totalRecoveredFromMissing:data.totalRecoveredFromMissing,totalLayout:data.totalLayout,totalCandidates:data.totalCandidates});
  } catch(error) {
    if(error.message!=='OCR_TIMEOUT'||signal?.aborted||!bestData)throw error;
    const parsed=parseReceiptPhoto(bestData),needsReview=!totalVerified&&Boolean(parsed.total);
    progress(100);
    return contextual({...bestData,totalNeedsReview:bestData.totalNeedsReview||needsReview,totalCandidates:bestData.totalCandidates?.length?bestData.totalCandidates:needsReview?[parsed.total]:[],totalRecovered:true});
  } finally {
    finished = true;
    signal?.removeEventListener('abort', cancel); signal?.removeEventListener('abort', abortFailure);
    if (worker) worker.terminate().catch(() => {});
  }
}
