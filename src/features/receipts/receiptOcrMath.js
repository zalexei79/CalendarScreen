import {looksLikeReceiptMath,parseReceipt,receiptMath,receiptMoney} from './receiptModel.js';

function numericRectangle(line) {
  const words=line.words||[],operator=words.findIndex(word=>/^(?:\d+(?:[.,]\d+)?)?[xх×*@]/iu.test(word.text));
  if(operator<0)return null;
  let first=operator;
  for(let index=operator-1;index>=Math.max(0,operator-3);index--){
    if(/^\d+(?:[.,]\d{1,4})?$/.test(words[index].text)){first=index;break;}
  }
  let last=operator;
  for(let index=operator;index<words.length;index++)if(/\d/.test(words[index].text))last=index;
  const selected=words.slice(first,last+1),x0=Math.min(...selected.map(word=>word.bbox.x0)),x1=Math.max(...selected.map(word=>word.bbox.x1));
  const y0=Math.min(...selected.map(word=>word.bbox.y0)),y1=Math.max(...selected.map(word=>word.bbox.y1)),padding=Math.max(2,Math.round((y1-y0)*.35));
  return {left:Math.max(0,x0-padding),top:Math.max(0,y0-padding),width:x1-x0+2*padding,height:y1-y0+2*padding};
}
const key=math=>`${Number(math.quantity)}|${math.unitPrice}|${math.printedTotal}`;

// Re-read actual pixels. Arithmetic can reject a reading, but cannot invent a price.
export async function refineReceiptMath(data,readLine,{signal,onProgress}={}) {
  let text=data.text||'';
  const parsed=parseReceipt(text),checkedSum=parsed.items.reduce((sum,item)=>sum+(receiptMoney(item.total)||0),0);
  const checkAll=Boolean(parsed.items.length&&receiptMoney(parsed.total)>0&&checkedSum!==receiptMoney(parsed.total));
  const lines=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
  const targets=lines.filter(line=>{const math=receiptMath(line.text);return looksLikeReceiptMath(line.text)&&!math?.unitUncertain&&(!math?.consistent||checkAll);}).slice(0,12);
  for(const [index,line]of targets.entries()){
    if(signal?.aborted)throw new Error('CANCELLED');
    const rectangle=numericRectangle(line);
    if(!rectangle)continue;
    const original=receiptMath(line.text),seen=new Map();
    let accepted=null;
    for(const mode of ['7','13']){
      if(signal?.aborted)throw new Error('CANCELLED');
      let reading;
      try{reading=await readLine(rectangle,mode);}catch(error){if(signal?.aborted||error.message==='CANCELLED')throw error;break;}
      const candidate=receiptMath(reading);
      if(!candidate?.consistent)continue;
      const candidateKey=key(candidate);
      // One independent reading may verify the original factors. Changing either
      // factor requires two agreeing line reads with a valid printed equation.
      const agreesWithFactors=original&&Number(original.quantity)===Number(candidate.quantity)&&original.unitPrice===candidate.unitPrice;
      seen.set(candidateKey,(seen.get(candidateKey)||0)+1);
      if(agreesWithFactors||seen.get(candidateKey)>=2){accepted=candidate;break;}
    }
    if(accepted&&(!original||key(accepted)!==key(original))){
      const start=String(line.text).match(/\d+(?:[.,]\d{1,4})?\s*([\p{L}]{1,4}\.?)?\s*[xх×*@]/iu);
      if(start){
        const unit=original?.unit||(/^(?:kg|кг)$/i.test(start[1]||'')?'kg':/^(?:l|л)$/i.test(start[1]||'')?'l':'pcs');
        const prefix=line.text.slice(0,start.index),replacement=`${prefix}${accepted.quantity} ${unit} × ${accepted.unitPrice} = ${accepted.printedTotal}`;
        text=text.replace(line.text.trim(),replacement.trim());
      }
    }
    onProgress?.(85+Math.round((index+1)/targets.length*14));
  }
  return text;
}
