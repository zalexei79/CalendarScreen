import{receiptMoney,moneyText,parseReceipt}from'./receiptModel.js';
import{receiptNonItemLine,receiptTotalAnchor}from'./receiptStructure.js';
// These clues can WITHHOLD a conflicting total, never authorize a new expense.
// Only literal labelled amounts become choices; item sums/cash are not totals.
export function receiptTotalReview(data,parsed){
 const source=String(data.contextText||data.text||''),lines=source.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),amounts=(data.totalCandidates||parsed.totalCandidates||[]).map(receiptMoney).filter(value=>value>0);
 const accounting=lines.filter(line=>receiptNonItemLine(line)).length,discount=lines.some(line=>/^(?:discount|diskon|disk\.?member|coupon|reduc|скидк|знижк)/iu.test(line));
 const current=receiptMoney(parsed.total);let conflict=Boolean(data.totalRecoveredFromMissing&&current>0);
 const ocrLines=(data.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
 for(const line of ocrLines){if(!receiptTotalAnchor(line.text))continue;const matching=(line.words||[]).filter(word=>receiptMoney(String(word.text).replace(/^[=:€$₽£¥₴]+/u,''))===current);if(matching.some(word=>Number.isFinite(word.confidence)&&word.confidence<80))conflict=true;}
 for(const line of lines){
  const review=line.match(/^(?:netto|net\s+total)\s*[:=]?\s*([\d.,\s'’]+)$/iu)||accounting>=2&&line.match(/^\d{1,3}\s+(?:grand\s+)?total\s*[:=]?\s*([\d.,\s'’]+)$/iu)||accounting>=2&&line.match(/^total\s*[:=]?\s*\(?\s*(?:qty|items?)\s*\d+(?:[.,]\d+)?\)?\s+([\d.,\s'’]+)$/iu);
  if(review){const value=receiptMoney(review[1]);if(value>0){amounts.push(value);if(current!==null&&value!==current)conflict=true;}}
  const subtotal=line.match(/^sub[\s-]*total\s*[:=]?\s*([\d.,\s'’]+)$/iu);
  if(subtotal&&!discount&&current>0&&(data.totalRecovered||data.totalLayout||data.contextText)){const value=receiptMoney(subtotal[1]);if(value>current*2)conflict=true;}
 }
 if(data.contextText&&current>0){const context=receiptMoney(parseReceipt(source).total);if(context>0&&context!==current){conflict=true;amounts.push(context);}}
 if(!conflict&&current>0)return null;
 if(current>0)amounts.unshift(current);
 const choices=[...new Set(amounts)].slice(0,3).map(moneyText);
 return conflict||choices.length?{total:'',totalCandidates:choices,preferTotalOnly:true}:null;
}
