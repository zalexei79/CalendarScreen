import{receiptTotalReview}from'./receiptTotalEvidence.js';
import{extractReceiptMerchant}from'./receiptMerchant.js';
import{receiptLayoutItems}from'./receiptLayoutItems.js';
import {parseReceipt,receiptLineTotal,receiptMoney,moneyText,receiptMath,validReceiptName,validReceiptDate} from './receiptModel.js';
import {receiptSignature} from './receiptStructure.js';

const numeric = value => String(value).trim().match(/^(\d+(?:[.,]\s*\d{1,2})?)$/)?.[1];
const linesOf = data => (data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
export function photoAmount(data) {
  const lines=String(data.text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean),numbers=lines.map(numeric).filter(Boolean).map(receiptMoney).filter(value=>value>0);
  const unknown={total:'',source:'unknown',expression:'',evidence:''};
  // A calculator or isolated number may supply an amount. Arbitrary receipt,
  // bank and trading prose cannot authorize selecting a prominent stray number.
  const expressionLine=line=>/^\d[\d.,\s]*[xх×*][\d.,\s]+(?:=[\d.,\s]+)?$/iu.test(line);
  const statusLine=line=>/^\s*(?:\d{1,2}:\d{2}\s*)?(?:LTE|Wi-?Fi|[45]G|ED|ow|\s|\d|%)*\s*$/iu.test(line);
  const prose=lines.filter(line=>/\p{L}/u.test(line)&&!statusLine(line)&&!/^(?:AC|CE|C|MC|MR|M\+|M-|MRC|Ans)$/i.test(line)&&!expressionLine(line));
  const calculatorNoise=lines.some(expressionLine)&&lines.some(line=>/^\d{1,2}:\d{2}/.test(line))&&prose.length<=2&&prose.every(line=>line.replace(/[^\p{L}]/gu,'').length<=4);
  if(receiptSignature(data.text)||parseReceipt(data.text).items.some(item=>validReceiptName(item.name))||prose.length&&!calculatorNoise)return unknown;
  const equations=[];
  for(const line of lines){
    const match=line.match(/^(\d+(?:[.,]\s*\d{1,3})?)\s*[×xх*]\s*(\d+(?:[.,]\s*\d{1,3})?)(?:\s*=\s*(\d+(?:[.,]\s*\d{1,2})?))?$/iu);
    if(!match)continue;
    const a=match[1].replace(/\s/g,''),b=match[2].replace(/\s/g,'');
    const cents=value=>/^\d+(?:[.,]\d{1,2})?$/.test(value);
    const result=(cents(a)?receiptLineTotal(b,a):'')||(cents(b)?receiptLineTotal(a,b):'');
    if(result&&(!match[3]||receiptMoney(match[3])===receiptMoney(result)))equations.push({total:result,expression:`${a} × ${b}`,evidence:line,printedResult:Boolean(match[3])});
  }
  const distinct=[...new Set(equations.map(item=>item.total))];
  if(distinct.length>1)return unknown;
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
  if(data.contextText){
    const context=parseReceipt(data.contextText);
    if(!parsed.items.length)parsed.items=context.items;
    parsed.documentIssue=parsed.documentIssue||context.documentIssue;
    for(const field of ['dateKey','currency'])parsed[field]=parsed[field]&&context[field]&&parsed[field]!==context[field]?'':parsed[field]||context[field];
    parsed.rawText=data.contextText;
  }
  if(!parsed.items.length&&(data.contextBlocks||data.blocks)?.length)parsed.items=receiptLayoutItems(data.contextText?{text:data.contextText,blocks:data.contextBlocks||[]}:data);
  const signature=receiptSignature(text)||receiptSignature(data.contextText||'');
  // A named priced row is already enough to require a printed receipt total.
  // It must never become an isolated "amount photo" when its total label is lost.
  const receipt=signature||parsed.items.some(item=>validReceiptName(item.name));
  if(receipt){
    const merchant=extractReceiptMerchant(data.contextText||text,{blocks:data.contextBlocks||data.blocks||[],items:parsed.items,totalLayout:Boolean(data.totalLayout&&!data.contextText)});
    const review=receiptTotalReview(data,parsed);
    return {...parsed,total:data.totalNeedsReview?'':parsed.total,totalCandidates:data.totalCandidates?.length?data.totalCandidates:parsed.totalCandidates||[],preferTotalOnly:Boolean(!parsed.total||data.totalNeedsReview||data.totalRecovered||data.totalCandidates?.length),...review,merchant:merchant.slice(0,120),kind:'receipt',amountSource:'receipt',expression:''};
  }
  const amount=photoAmount(data);
  return {...parsed,kind:'amount',merchant:'',items:[],category:'Другое',dateKey:validReceiptDate(defaultDateKey,today)?defaultDateKey:today,currency:parsed.currency||defaultCurrency,total:amount.total,evidence:amount.evidence,amountSource:amount.source,expression:amount.expression};
}
