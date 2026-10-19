import {classifyProduct} from './productCatalog.js';
import {normalizeReceiptText,receiptMoney,moneyText,receiptLineTotal,validReceiptName} from './receiptModel.js';

// Read both the original plain-text receipts and new, explicitly marked receipts.
// This is a read-only view: historic totals and source comments are not rewritten.
export function readSavedReceipt(comment,currency='') {
  if(typeof comment!=='string'||comment.length>50000)return null;
  const lines=comment.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),marked=lines[0]?.startsWith('🧾');
  const pattern=/^(.+?)\s+·\s+(\d+(?:[.,]\d{1,3})?)\s*(kg|кг|l|л)?\s*[×xх]\s*(\d+(?:[.,]\d{1,2}))\s*=\s*(\d+(?:[.,]\d{1,2}))\s+([A-Z]{3})$/u;
  const rows=[],prefix=[];
  for(const line of lines){
    const match=line.match(pattern);
    if(!match){if(rows.length)return null;prefix.push(line);continue;}
    const [,label,quantity,unit,unitPrice,total,code]=match;
    if(currency&&code!==currency)return null;
    const original=marked?label.match(/^(.+?)\s+\[([\s\S]*)\]$/):null;
    const name=original?original[2]:label;
    if(!validReceiptName(name)||receiptMoney(total)===null||receiptMoney(unitPrice)===null)return null;
    const type=marked&&original?classifyProduct(original[1])?.id||'':'';
    rows.push({name,quantity:quantity.replace(',','.'),unit:/^(kg|кг)$/.test(unit||'')?'kg':/^(l|л)$/.test(unit||'')?'l':'pcs',unitPrice:moneyText(receiptMoney(unitPrice)),total:moneyText(receiptMoney(total)),currency:code,productType:type});
  }
  if(!marked&&(!rows.length||prefix.length!==1||rows.length<2&&!/s\.?r\.?l|magazin|store|shop|market|магазин|маркет|магазин|pharmacy|farmaci|аптек|商店/iu.test(prefix[0])))return null;
  if(marked&&prefix.length!==1)return null;
  const codes=[...new Set(rows.map(item=>item.currency))];if(codes.length>1)return null;
  return{merchant:marked?prefix[0].replace(/^🧾\s*/u,''):prefix[0],items:rows,currency:currency||codes[0]||'',marked};
}
export function receiptFromEntry(entry) {
  if(Number(entry?.pnl)>=0||!Number.isFinite(Number(entry?.pnl))||entry?.traderMode===true||entry?.platform&&entry.platform!=='Manual')return null;
  const receipt=readSavedReceipt(entry?.comment,entry.currency||'USD');
  if(!receipt)return null;
  const total=Math.round(Math.abs(Number(entry.pnl))*100),sum=receipt.items.reduce((value,item)=>value+receiptMoney(item.total),0);
  return{...receipt,total:moneyText(total),sum:moneyText(sum),difference:moneyText(Math.abs(total-sum)),mismatch:receipt.items.length>0&&sum!==total,lineMismatch:receipt.items.some(item=>receiptMoney(receiptLineTotal(item.quantity,item.unitPrice))!==receiptMoney(item.total))};
}
export function receiptFingerprint(receipt) {
  return JSON.stringify([normalizeReceiptText(receipt.merchant),receipt.items.map(item=>[normalizeReceiptText(item.name),Number(item.quantity),item.unit||'pcs',receiptMoney(item.unitPrice),receiptMoney(item.total)])]);
}
