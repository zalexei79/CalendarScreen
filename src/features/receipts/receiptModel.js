import {classifyProduct,presentProduct,normalizeProductText} from './productCatalog.js';
import {receiptTotalLine,receiptNonItemLine,receiptDocumentIssue} from './receiptStructure.js';
// Receipt arithmetic uses minor units; OCR output never writes a calendar entry.
export const normalizeReceiptText = normalizeProductText;
export function receiptMoney(value) {
  const text = String(value ?? '').trim().replace(/[\s\u00a0'’]/g, '');
  if (!/^\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?$/.test(text)) return null;
  const decimal = text.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? text.slice(0, decimal.index) : text).replace(/[.,]/g, '');
  const result = Number(whole) * 100 + Number((decimal?.[1] || '').padEnd(2, '0'));
  return Number.isSafeInteger(result) && result < 1e14 ? result : null;
}
export const moneyText = minor => minor === null ? '' : (minor / 100).toFixed(2);
export function receiptLineTotal(quantity, unitPrice) {
  const price = receiptMoney(unitPrice), qty = String(quantity).replace(',', '.');
  if (price === null || !/^\d+(?:\.\d{1,4})?$/.test(qty) || Number(qty) <= 0 || qty.length>16) return '';
  const [whole, fraction = ''] = qty.split('.');
  const numerator = BigInt(whole + fraction), denominator = 10n ** BigInt(fraction.length);
  const result = (BigInt(price) * numerator + denominator / 2n) / denominator;
  return result < 100000000000000n ? moneyText(Number(result)) : '';
}
// Only read factors from the same printed equation; never derive them from a receipt total.
export function receiptMath(value) {
  const match = String(value).match(/(?<![\d.,+\-−])(\d+(?:\s*[.,]\s*\d{1,4})?)\s*([\p{L}]{1,4}\.?)?\s*[xх×*@]\s*(\d+(?:[ \u00a0'’]\d{3})*(?:\s*[.,]\s*\d{1,2})?)\s*(?:[=:\-]\s*|\s+)(\d+(?:[ \u00a0'’]\d{3})*(?:\s*[.,]\s*\d{1,2})?)(?![\d.,])[^\d]{0,12}$/iu);
  if (!match) return null;
  const quantity = match[1].replace(/\s/g,'').replace(',','.'), unitPrice = moneyText(receiptMoney(match[3])), printedTotal = moneyText(receiptMoney(match[4]));
  const unit = /^(?:kg|кг)$/i.test(match[2] || '') ? 'kg' : /^(?:l|л)$/i.test(match[2] || '') ? 'l' : 'pcs';
  const total = receiptLineTotal(quantity,unitPrice);
  const unitUncertain=Boolean(match[2]&&!/^(?:buc|duc|pcs|pc|шт|kg|кг|l|л)\.?$/iu.test(match[2]));
  return {index:match.index,quantity,unit,unitPrice,printedTotal,total,consistent:Boolean(total && receiptMoney(total) === receiptMoney(printedTotal)),...(unitUncertain?{unitUncertain:true}:{})};
}
export const looksLikeReceiptMath = value => /(?:\d[\d\s.,]*|\b(?:buc|pcs|шт|kg|кг|l)\s*)\s*(?:[\p{L}]{1,4}\.?\s*)?[xх×*@]\s*\d/iu.test(value);
export function receiptItemMathIssue(item) {
  const calculated = receiptMoney(receiptLineTotal(item.quantity,item.unitPrice));
  return calculated===null || receiptMoney(item.total) !== calculated || (!item.priceReviewed && (item.mathUncertain || item.printedTotal !== undefined && receiptMoney(item.printedTotal) !== calculated));
}
export const receiptItemIssue = item => !validReceiptName(item.name) || receiptItemMathIssue(item);
const moneyTokens = line => [...line.replace(/[.·]{2,}/g,dots=>' '.repeat(dots.length)).matchAll(/(?<![\p{L}\d.,])\d+(?:[ \u00a0'’.,]\d{3})*[.,]\d{2}(?![\d.,])/gu)];
export function cleanReceiptName(value) {
  return String(value || '').replace(/^[|\\\s]+|[|\\\s]+$/g,'').replace(/\s+/g,' ').trim();
}
export function validReceiptName(value) {
  const text = normalizeReceiptText(cleanReceiptName(value));
  // A broken price row is not a product name. Keep it available in raw OCR,
  // but require a correction instead of presenting it as a purchase.
  const words = text.replace(/[\d.,=:%+*×х|\\-]/g,' ').split(/\s+/).filter(Boolean);
  return words.some(word => (word.length > 1 || /\p{Script=Han}/u.test(word)) && /[\p{L}]/u.test(word) && !/^(?:buc|duc|бис|pcs|pc|шт|kg|кг|gr|g|ml|l|x|a|b|c)$/i.test(word));
}
export function receiptProduct(value, language = 'ru', preferredType = '') {
  if (!validReceiptName(value)) return {title:'',detail:'',original:cleanReceiptName(value),symbol:'',type:'',category:'Другое'};
  return presentProduct(value,language,preferredType);
}
export function receiptCategory(value) {
  const items=Array.isArray(value)?value:String(value||'').split(/\n/).map(name=>({name}));
  const scores=new Map();
  for(const item of items){const type=classifyProduct(item.name,item.productType);if(!type)continue;const weight=Array.isArray(value)?Math.max(1,receiptMoney(item.total)||0):1;scores.set(type.category,(scores.get(type.category)||0)+weight);}
  return [...scores].sort((a,b)=>b[1]-a[1])[0]?.[0]||'Другое';
}
export function validReceiptDate(value, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(+date) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` === value && value <= today;
}
export function parseReceipt(rawText) {
  const lines = String(rawText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const candidates = [];
  for (let index = 0; index < lines.length; index++) {
    const label = receiptTotalLine(lines[index]);
    if (!label) continue;
    const next = lines[index + 1] || '';
    // Currency may wrap together with the total; no other text may be consumed.
    const wrapped=!label.amount?receiptTotalLine(`TOTAL ${next}`):null;
    const amount=receiptMoney(label.amount||wrapped?.amount);
    if(amount!==null)candidates.push({amount,role:label.role,index,evidence:lines[index]+(wrapped?.amount?`\n${next}`:'')});
  }
  const finals=candidates.filter(item=>item.role==='final'),selected=finals.length?finals:candidates;
  const unique = [...new Set(selected.map(item => item.amount))];
  const total = unique.length === 1 ? moneyText(unique[0]) : '';
  const normalized = normalizeReceiptText(rawText);
  const explicitCurrencies = [...new Set([
    [/\bmdl\b|moldova|moldretail|\bidno\b/i, 'MDL'], [/\busd\b|\bus\$/i, 'USD'],
    [/\beur\b|(?<!\p{L})€(?!\p{L})/iu, 'EUR'], [/\brub\b|₽|руб/i, 'RUB'], [/\bcny\b|\brmb\b|人民币/i, 'CNY'], [/\bron\b/i, 'RON'],
  ].filter(([pattern]) => pattern.test(normalized)).map(([,code]) => code))];
  let dateKey = '';
  const dateMatches=[...String(rawText).matchAll(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b|\b(\d{4})[./-](\d{2})[./-](\d{2})\b/g)];
  const dates=[...new Set(dateMatches.map(match=>match[1]?`${match[3]}-${match[2]}-${match[1]}`:`${match[4]}-${match[5]}-${match[6]}`))];
  if(dates.length===1)dateKey=dates[0];
  if(!dateMatches.length){
    // Legacy cash registers print a two-digit year next to the time. Do not
    // interpret arbitrary dotted product codes as dates or roll future years back.
    const shortDates=[...String(rawText).matchAll(/\b(\d{2})[./-](\d{2})[./-](\d{2})\s+\d{1,2}:\d{2}\b/g)];
    const keys=[...new Set(shortDates.map(match=>`20${match[3]}-${match[2]}-${match[1]}`))];
    if(keys.length===1)dateKey=keys[0];
  }
  const items = [];
  let pending = [];
  for (let index=0;index<lines.length;index++) {
    let line=lines[index];
    const normalizedLine = normalizeReceiptText(line);
    if (receiptTotalLine(line)||/^(?:всего|итого?)\s*[.,:=]/iu.test(normalizedLine)) break;
    if (receiptNonItemLine(line)) { pending = []; continue; }
    if (/casier|cashier|кассир|idno|idnp|\binr\b|\btva\b|\bvat\b|str\.|s\.r\.l|\bbon\b|\btelefon\b|\btel\b|ккм|инн|эклз|^чек\s*[№#]/i.test(normalizedLine)) { pending = []; continue; }
    // Join only an unfinished printed equation and a numeric continuation.
    // Never borrow a factor or amount from the next named product.
    if((looksLikeReceiptMath(line)||/\d\s*(?:[\p{L}]{1,4}\s*)?[xх×*@]\s*$/iu.test(line))&&!receiptMath(line)&&/[xх×*@=:]\s*$/iu.test(line)&&/^\d[\d\s.,=:'’]*\s*[A-C]?$/iu.test(lines[index+1]||'')&&receiptMath(`${line} ${lines[index+1]}`))line+=` ${lines[++index]}`;
    const costLine=lines[index+1]||'',costAmount=moneyTokens(costLine).at(-1);
    if(looksLikeReceiptMath(line)&&!receiptMath(line)&&costAmount&&/^(?:стоимост[ьb]|ctohmoctb|ctommoctb|cost|value|valoare)/iu.test(normalizeReceiptText(costLine))&&receiptMath(`${line} = ${costAmount[0]}`)){
      line+=` = ${costAmount[0]}`;index++;
    }
    const multiplication = receiptMath(line);
    const amounts = moneyTokens(line);
    const last = amounts.at(-1);
    if (multiplication || last && /^\s*[^\d]{0,12}$/i.test(line.slice(last.index + last[0].length))) {
      let name = multiplication ? line.slice(0, multiplication.index).trim() : line.slice(0, last.index).trim();
      name = cleanReceiptName(name);
      if(/^(?:стоимост[ьb]|ctohmoctb|ctommoctb|cost\b|value\b|valoare\b)/iu.test(normalizeReceiptText(name)))name='';
      if (!validReceiptName(name) || /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name)) name = cleanReceiptName([...pending.filter(validReceiptName), /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name) ? name : ''].filter(Boolean).join(' '));
      const amount = multiplication ? multiplication.printedTotal : moneyText(receiptMoney(last[0]));
      const quantity = multiplication?.quantity || '1', unit = multiplication?.unit || 'pcs', unitPrice = multiplication?.unitPrice || amount;
      const uncertain=multiplication?multiplication.unitUncertain||unit==='pcs'&&!Number.isInteger(Number(quantity)) : looksLikeReceiptMath(line)||/[-−]\s*\d|[xх×*@]\s*\d/iu.test(line)||amounts.length>1||/\d\s+\d+\s*$/.test(name);
      if (receiptMoney(amount) !== null) items.push({name: validReceiptName(name) ? name.slice(0,180) : '', quantity, unit, unitPrice, total:receiptLineTotal(quantity,unitPrice), printedTotal:amount, ...(uncertain ? {mathUncertain:true} : {})});
      pending = [];
    } else if (moneyTokens(line).length) pending = [];
    else if (/[\p{L}]/u.test(line) && !/\d{2}[:/-]\d{2}|^\s*\d{6,}/.test(line)) pending = [...pending.slice(-1), line];
  }
  const documentIssue=receiptDocumentIssue(lines)||(finals.length>1&&lines.filter(line=>/^(?:bon\s+fiscal|fiscal\s+receipt|кассовый\s+чек)\s*$/iu.test(normalizeReceiptText(line))).length>1?'multipleReceipts':'');
  return {merchant: lines.find(line => /[\p{L}]/u.test(line))?.slice(0,120) || '', dateKey, currency: explicitCurrencies.length === 1 ? explicitCurrencies[0] : '', total, items, category: receiptCategory(items), evidence: total ? selected.find(item => item.amount === unique[0])?.evidence || '' : '', rawText: String(rawText || '').slice(0,40000), ambiguousTotal: unique.length > 1, documentIssue};
}
export function receiptValidation(draft, today, currencies) {
  const total = receiptMoney(draft.total);
  const invalidItem = draft.items.some(receiptItemIssue);
  const sum = draft.items.reduce((value,item) => value + (receiptMoney(receiptLineTotal(item.quantity,item.unitPrice)) || 0), 0);
  const lineMismatch = draft.items.some(receiptItemMathIssue);
  const mismatch = Boolean(draft.items.length && sum !== total);
  // The printed total is independent evidence, never proof that OCR item prices are correct.
  return { valid: !draft.documentIssue && total > 0 && currencies.includes(draft.currency) && validReceiptDate(draft.dateKey, today) && !invalidItem && !lineMismatch && !mismatch, total, sum, mismatch, lineMismatch };
}
export function receiptComment(draft,language='ru') {
  if(draft.kind==='amount'){
    const label=String(language).startsWith('zh')?'照片中的金额':['ro','md'].includes(language)?'Sumă din fotografie':language==='en'?'Amount from photo':'Сумма с фото';
    const equation=draft.expression?`${draft.expression} = ${moneyText(receiptMoney(draft.total))}`:'';
    return [`📷 ${draft.merchant.trim()||label}`,receiptMath(equation)?.consistent?`${equation} ${draft.currency}`:''].filter(Boolean).join('\n');
  }
  return [`🧾 ${draft.merchant.trim()}`, ...draft.items.map(item => {
    const product=receiptProduct(item.name,language,item.productType), original=item.name.trim();
    const label=product.type?`${product.symbol} ${product.title} [${original}]`:original;
    return `${label} · ${item.quantity}${item.unit === 'kg' ? ' kg' : item.unit === 'l' ? ' l' : ''} × ${moneyText(receiptMoney(item.unitPrice))} = ${receiptLineTotal(item.quantity,item.unitPrice)} ${draft.currency}`;
  })].join('\n');
}
