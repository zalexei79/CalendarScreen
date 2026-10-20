import {parseReceipt,receiptLineTotal,receiptMoney,moneyText,receiptMath,validReceiptName,validReceiptDate,normalizeReceiptText} from './receiptModel.js';
import {receiptSignature,receiptTotalLine,receiptNonItemLine} from './receiptStructure.js';

const numeric = value => String(value).trim().match(/^(\d+(?:[.,]\s*\d{1,2})?)$/)?.[1];
const linesOf = data => (data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
export function photoAmount(data) {
  const lines=String(data.text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean),numbers=lines.map(numeric).filter(Boolean).map(receiptMoney).filter(value=>value>0);
  const equations=[];
  for(const line of lines){
    const match=line.match(/^(\d+(?:[.,]\s*\d{1,3})?)\s*[×xх*]\s*(\d+(?:[.,]\s*\d{1,3})?)(?:\s*=\s*(\d+(?:[.,]\s*\d{1,2})?))?$/iu);
    if(!match)continue;
    const a=match[1].replace(/\s/g,''),b=match[2].replace(/\s/g,''),result=receiptLineTotal(b,a)||receiptLineTotal(a,b);
    if(result&&(!match[3]||receiptMoney(match[3])===receiptMoney(result)))equations.push({total:result,expression:`${a} × ${b}`,evidence:line,printedResult:Boolean(match[3])});
  }
  const distinct=[...new Set(equations.map(item=>item.total))];
  if(distinct.length===1){
    if(numbers.length&&!numbers.includes(receiptMoney(distinct[0]))&&!equations.some(item=>item.printedResult))return {total:'',source:'unknown',expression:'',evidence:''};
    return {...equations[0],source:'calculation'};
  }
  const prominent=linesOf(data).filter(line=>numeric(line.text)&&receiptMoney(numeric(line.text))>0).map(line=>({total:moneyText(receiptMoney(numeric(line.text))),height:line.bbox.y1-line.bbox.y0,evidence:line.text.trim()})).sort((a,b)=>b.height-a.height);
  if(prominent.length&&(!prominent[1]||prominent[0].height>=prominent[1].height*1.5))return {...prominent[0],source:'number',expression:''};
  const unique=[...new Set(numbers)];
  return unique.length===1?{total:moneyText(unique[0]),source:'number',expression:'',evidence:moneyText(unique[0])}:{total:'',source:'unknown',expression:'',evidence:''};
}

export function parseReceiptPhoto(input,{today='',defaultDateKey=today,defaultCurrency=''}={}) {
  const data=typeof input==='string'?{text:input}:input||{text:''},text=String(data.text||''),parsed=parseReceipt(text),lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const signature=receiptSignature(text);
  // A named priced row is already enough to require a printed receipt total.
  // It must never become an isolated "amount photo" when its total label is lost.
  const receipt=signature||parsed.items.some(item=>validReceiptName(item.name));
  if(receipt){
    const candidates=lines.filter(line=>validReceiptName(line)&&!/^\s*\d{1,2}:\d{2}|\b(?:LTE|WiFi|Wi-Fi|4G|5G)\b/iu.test(line)&&!receiptMath(line)&&!receiptTotalLine(line)&&!receiptNonItemLine(line)&&!/\bidno\b|bon\s+fiscal|fiscal\s+receipt|кассовый\s+чек/iu.test(normalizeReceiptText(line)));
    const merchant=candidates.find(line=>/s\.?r\.?l|\bltd\b|\bllc\b|\bООО\b/iu.test(line))||candidates[0]||'';
    return {...parsed,merchant:merchant.slice(0,120),kind:'receipt',amountSource:'receipt',expression:''};
  }
  const amount=photoAmount(data);
  return {...parsed,kind:'amount',merchant:'',items:[],category:'Другое',dateKey:validReceiptDate(defaultDateKey,today)?defaultDateKey:today,currency:parsed.currency||defaultCurrency,total:amount.total,evidence:amount.evidence,amountSource:amount.source,expression:amount.expression};
}
