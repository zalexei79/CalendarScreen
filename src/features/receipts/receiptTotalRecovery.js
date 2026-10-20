import {parseReceiptPhoto} from './receiptPhoto.js';
import {receiptDocumentIssue} from './receiptStructure.js';
import {refineReceiptTotals,locateReceiptTotal} from './receiptOcrTotal.js';

// Finding a heading is not successful recovery. Keep trying independent image
// regions until there is an actual total or readable choices to review.
export async function recoverReceiptTotal(scans,read,{signal,onProgress}={}) {
  for(const {image,mode} of scans){
    if(signal?.aborted)throw new Error('CANCELLED');
    const data=await read(image,{mode});
    if(receiptDocumentIssue(String(data.text||'').split(/\r?\n/)))continue;
    const refine=source=>refineReceiptTotals({...source,totalRecovered:true},async(rectangle,mode)=>(await read(image,{mode,rectangle,numeric:true})).text,{signal,onProgress});
    const useful=source=>{const parsed=parseReceiptPhoto(source);return parsed.kind==='receipt'&&Boolean(parsed.total||source.totalCandidates?.length);};
    const checked=await refine(data);
    if(useful(checked))return {data:checked,input:image};
    const located=await locateReceiptTotal(data,async(rectangle,mode)=>(await read(image,{mode,rectangle})).text,{signal});
    if(located){
      const checked=await refine(located);
      if(useful(checked))return {data:checked,input:image};
    }
  }
  return null;
}
