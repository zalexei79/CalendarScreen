import {receiptTotalAnchor,receiptTotalLine,receiptNonItemLine} from './receiptStructure.js';
import {receiptMoney,moneyText,parseReceipt} from './receiptModel.js';

const linesOf=data=>(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
function labelEnd(line){
  const words=line.words||[];
  for(let end=0;end<words.length;end++){
    const prefix=receiptTotalAnchor(words.slice(0,end+1).map(word=>word.text).join(' '));
    if(prefix&&!prefix.tail.trim())return words[end].bbox.x1;
  }
  return line.bbox?.x0;
}
function totalCandidate({line,anchor}){
  if(!anchor||receiptNonItemLine(line.text))return false;
  if(receiptTotalLine(line.text)||!/[\p{L}]{3,}/u.test(anchor.tail.replace(/\b(?:MDL|RON|USD|EUR|RUB|CNY|UAH|LEI)\b|грн/giu,'')))return true;
  const words=(line.words||[]).filter(word=>word.bbox.x0>=labelEnd(line)),digits=words.filter(word=>/\d/.test(word.text)),height=Math.max(0,...digits.map(word=>word.bbox.y1-word.bbox.y0)),firstDigit=Math.min(...digits.map(word=>word.bbox.x0));
  // OCR may merge tiny footer print into the tall total row. Product words
  // at the same height as the amount remain disqualifying ("Total cereal").
  return height>0&&words.every(word=>word.bbox.x0>=firstDigit||!/[\p{L}]{3,}/u.test(word.text)||word.bbox.y1-word.bbox.y0<height*.5);
}
const numericReading=value=>{
  const text=String(value||'').trim().replace(/^[=:]+/,'').trim();
  // Decimal separators may be surrounded by OCR whitespace. Multiple amounts,
  // signs and a bare three-decimal weight are never accepted as a final amount.
  if(!/^\d+(?:[ '\u00a0’.,]\d{3})*(?:\s*[.,]\s*\d{1,2})?$/.test(text))return null;
  return receiptMoney(text.replace(/\s*([.,])\s*/g,'$1'));
};
export async function refineReceiptTotals(data,readLine,{signal,onProgress}={}){
  const lines=linesOf(data),anchors=lines.map((line,index)=>({line,index,anchor:receiptTotalAnchor(line.text)})).filter(totalCandidate);
  const finals=anchors.filter(row=>row.anchor.role==='final'),pool=finals.length?finals:anchors,priority=Math.max(1,...pool.map(row=>row.anchor.priority||1)),targets=pool.filter(row=>(row.anchor.priority||1)===priority).slice(0,3);
  let text=String(data.text||''),totalNeedsReview=Boolean(data.totalNeedsReview),totalRecovered=Boolean(data.totalRecovered),totalCandidates=[];
  for(const [number,{line,index,anchor}]of targets.entries()){
    if(signal?.aborted)throw new Error('CANCELLED');
    if(/^\s*[-−]/.test(anchor.tail))continue;
    const amounts=anchor.tail.match(/\d+(?:[ '\u00a0’]\d{3})*[.,]\d{1,2}(?![\d.,])/g)||[];
    if(amounts.length>1||/[xх×*%+]/iu.test(anchor.tail)){totalNeedsReview=true;continue;}
    let source=line,left=labelEnd(line);
    const wrapped=!anchor.tail.trim()&&lines[index+1]&&/^\s*(?:[A-Z]{3}\s*)?\d[\d\s.,'’]*$/u.test(lines[index+1].text);
    if(wrapped){source=lines[index+1];left=source.bbox.x0;}
    if(!source.bbox||left===undefined||source.bbox.x1-left<5)continue;
    let afterLabel=(source.words||[]).filter(word=>word.bbox.x0>=left&&/\d/.test(word.text));
    const amountWord=afterLabel.findLast(word=>/\d\s*[.,]\s*\d/.test(word.text))||afterLabel.at(-1);
    let box=amountWord?.bbox||{...source.bbox,x0:left};
    if(amountWord){
      const amountHeight=box.y1-box.y0;
      afterLabel=afterLabel.filter(word=>!(word.bbox.x0>box.x1+amountHeight*.75&&word.bbox.y1-word.bbox.y0<amountHeight*.75));
      if(/^[=:€$₽£¥₴]+\s*\d/.test(amountWord.text)){
        const firstDigit=amountWord.symbols?.find(symbol=>/\d/.test(symbol.text));
        if(firstDigit)box={...box,x0:firstDigit.bbox.x0};
      }
      let position=source.words.indexOf(amountWord);
      while(position>0){
        const before=source.words[position-1];
        const splitFraction=/^[„.,]\d{2}$/.test(amountWord.text);
        if(!/^\d{1,3}$/.test(before.text)||before.bbox.x0<left||box.x0-before.bbox.x1>=box.y1-box.y0||!splitFraction&&receiptMoney(before.text+' '+amountWord.text)===null)break;
        box={...box,x0:before.bbox.x0,y0:Math.min(box.y0,before.bbox.y0),y1:Math.max(box.y1,before.bbox.y1)};position--;
      }
      const outside=afterLabel.filter(word=>word!==amountWord&&(word.bbox.x0<box.x0||word.bbox.x1>box.x1));
      if(outside.length){
        totalNeedsReview=true;
        // A separate count beside an already grouped price stays outside the
        // crop. Its presence still requires review of the reread amount.
        if(!outside.every(word=>word.bbox.x1<=box.x0&&/^\d{1,3}$/.test(word.text)&&receiptMoney(word.text+' '+amountWord.text)===null))continue;
      }
    }
    const height=box.y1-box.y0,pad=Math.max(3,Math.round(height*(data.totalLayout ? .1 : .2)));
    const rectangle={left:Math.max(0,box.x0-pad),top:Math.max(0,box.y0-pad),width:box.x1-box.x0+2*pad,height:height+2*pad};
    const readings=[],needsDecimal=Boolean(data.totalRequiresDecimal||/[.,]\s*\d{1,2}(?!\d)/.test(anchor.tail));
    for(const mode of ['7','13']){
      if(signal?.aborted)throw new Error('CANCELLED');
      try{const reading=await readLine(rectangle,mode);readings.push(needsDecimal&&!/[.,]\s*\d{1,2}(?!\d)/.test(reading)?null:numericReading(reading));}
      catch(error){if(signal?.aborted||error.message==='CANCELLED'||error.message==='OCR_TIMEOUT')throw error;readings.push(null);}
    }
    const accepted=readings.length===2&&readings[0]>0&&readings[0]===readings[1];
    if(accepted){
      if(totalNeedsReview)totalCandidates.push(moneyText(readings[0]));
      totalRecovered=totalRecovered||anchor.fuzzy||!receiptTotalLine(line.text);
      const currency=anchor.tail.match(/\b(?:MDL|RON|USD|EUR|RUB|CNY|UAH|LEI|GBP|CHF|PLN|JPY)\b|грн\.?|руб\.?|[€$₽£¥₴]/giu)?.join(' ')||'';
      const replacement=`${anchor.role==='due'?'AMOUNT DUE':anchor.priority>1?'GRAND TOTAL':'TOTAL'} ${currency} ${moneyText(readings[0])}`.replace(/\s+/g,' ');
      text=text.replace(line.text.trim(),replacement);
    }else{
      totalNeedsReview=true;totalCandidates.push(...readings.filter(value=>value>0).map(moneyText));
    }
    onProgress?.(82+Math.round((number+1)/targets.length*3));
  }
  if(!targets.length&&parseReceipt(data.text||'').total)totalNeedsReview=true;
  // An exact, independently printed total can still be offered for explicit
  // photo review when a second pixel reading is inconclusive. Never auto-pick it.
  if(totalNeedsReview&&!totalCandidates.length){const printed=parseReceipt(data.text||'').total;if(receiptMoney(printed)>0)totalCandidates.push(printed);}
  return {...data,text,totalNeedsReview,totalRecovered,totalCandidates:totalNeedsReview?[...new Set(totalCandidates)].slice(0,3):[]};
}

// Font size/position only locates a region. A separately read total LABEL must
// authorize the numeric rereads; neither font size nor monetary value is a total.
export async function locateReceiptTotal(data,readRegion,{signal}={}){
  const lines=linesOf(data),words=lines.flatMap(line=>line.words||[]),heights=words.filter(word=>/\d/.test(word.text)).map(word=>word.bbox.y1-word.bbox.y0).sort((a,b)=>a-b);
  const typical=heights[Math.floor(heights.length/2)]||0,bottom=Math.max(0,...lines.map(line=>line.bbox?.y1||0));
  // A damaged numeric token ("695. ЭЙ", "69S.5O") is exactly why we need
  // another read. Requiring a correct money string here skipped that recovery.
  const targets=words.filter(word=>/^\d[\d.,\p{L}|]*$/u.test(word.text)&&(word.text.match(/\d/g)||[]).length>=2&&word.bbox.y1-word.bbox.y0>typical*1.4&&word.bbox.y0>bottom*.45&&word.bbox.x0>word.bbox.y1-word.bbox.y0).sort((a,b)=>(b.bbox.y1-b.bbox.y0)-(a.bbox.y1-a.bbox.y0)).slice(0,3);
  for(const word of targets){
    if(signal?.aborted)throw new Error('CANCELLED');
    let numericWord={...word,bbox:{...word.bbox}},height=word.bbox.y1-word.bbox.y0;
    // Segmentation may attach a separator/tax row to the first digits, making
    // their box twice as tall. The adjacent fractional token supplies the font
    // height; it never supplies or changes the amount itself.
    const reference=words.filter(next=>next!==word&&next.bbox.x0>=word.bbox.x1&&next.bbox.x0-word.bbox.x1<height&&next.bbox.y1-next.bbox.y0>=height*.3&&next.bbox.y1-next.bbox.y0<height/1.5&&Math.min(next.bbox.y1,word.bbox.y1)-Math.max(next.bbox.y0,word.bbox.y0)>(next.bbox.y1-next.bbox.y0)*.8).sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];
    if(reference){
      const size=reference.bbox.y1-reference.bbox.y0;
      numericWord.bbox.y0=Math.max(word.bbox.y0,reference.bbox.y0-Math.round(size*.12));numericWord.bbox.y1=Math.min(word.bbox.y1,reference.bbox.y1+Math.round(size*.15));height=numericWord.bbox.y1-numericWord.bbox.y0;
    }
    const width=Math.round(word.bbox.x0*.45),rectangles=[{left:0,top:Math.max(0,numericWord.bbox.y0+Math.round(height*.15)),width,height:Math.round(height*1.2)},{left:0,top:Math.max(0,numericWord.bbox.y0-Math.round(height*.15)),width,height:Math.round(height*1.8)}];
    for(const rectangle of rectangles)for(const mode of ['7','13']){
      const label=String(await readRegion(rectangle,mode)).trim(),anchor=receiptTotalAnchor(label);
      if(!anchor||!/^[\s.,:：=·•_\-—]*$/.test(anchor.tail)||receiptNonItemLine(label))continue;
      let amount=numericWord;
      const following=words.filter(next=>next!==word&&next.bbox.x0>=word.bbox.x1&&Math.abs((next.bbox.y0+next.bbox.y1-numericWord.bbox.y0-numericWord.bbox.y1)/2)<height*.35&&next.bbox.y1-next.bbox.y0>=height*.6).sort((a,b)=>a.bbox.x0-b.bbox.x0);
      for(const next of following){
        if(next.bbox.x0-amount.bbox.x1>height*1.2)break;
        amount={text:`${amount.text} ${next.text}`,bbox:{x0:amount.bbox.x0,x1:next.bbox.x1,y0:Math.min(amount.bbox.y0,next.bbox.y0),y1:Math.max(amount.bbox.y1,next.bbox.y1)}};
      }
      const line={text:`${label} ${amount.text}`,bbox:{...amount.bbox,x0:0},words:[{text:label,bbox:{...word.bbox,x0:0,x1:rectangle.width}},amount]};
      return {...data,text:`${data.text}\n${line.text}`,blocks:[{paragraphs:[{lines:[line]}]}],totalRecovered:true,totalLayout:true,totalRequiresDecimal:/[.,]/.test(amount.text)};
    }
  }
  return null;
}
