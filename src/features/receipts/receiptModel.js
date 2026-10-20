import {classifyProduct,presentProduct,normalizeProductText} from './productCatalog.js';
// Receipt arithmetic uses minor units; OCR output never writes a calendar entry.
export const normalizeReceiptText = normalizeProductText;
export function receiptMoney(value) {
  const text = String(value ?? '').trim().replace(/[\s\u00a0']/g, '');
  if (!/^\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?$/.test(text)) return null;
  const decimal = text.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? text.slice(0, decimal.index) : text).replace(/[.,]/g, '');
  const result = Number(whole) * 100 + Number((decimal?.[1] || '').padEnd(2, '0'));
  return Number.isSafeInteger(result) && result < 1e14 ? result : null;
}
export const moneyText = minor => minor === null ? '' : (minor / 100).toFixed(2);
export function receiptLineTotal(quantity, unitPrice) {
  const price = receiptMoney(unitPrice), qty = String(quantity).replace(',', '.');
  if (price === null || !/^\d+(?:\.\d{1,3})?$/.test(qty) || Number(qty) <= 0) return '';
  const [whole, fraction = ''] = qty.split('.');
  const numerator = BigInt(whole + fraction), denominator = 10n ** BigInt(fraction.length);
  const result = (BigInt(price) * numerator + denominator / 2n) / denominator;
  return result < 100000000000000n ? moneyText(Number(result)) : '';
}
// Only read factors from the same printed equation; never derive them from a receipt total.
export function receiptMath(value) {
  const match = String(value).match(/(\d+(?:\s*[.,]\s*\d{1,3})?)\s*([\p{L}]{1,4}\.?)?\s*[xх×*]\s*(\d+(?:\s*[.,]\s*\d{1,2})?)\s*(?:[=:\-]\s*|\s+)(\d+(?:\s*[.,]\s*\d{1,2})?)(?![\d.,])[^\d]{0,12}$/iu);
  if (!match) return null;
  const quantity = match[1].replace(/\s/g,'').replace(',','.'), unitPrice = moneyText(receiptMoney(match[3])), printedTotal = moneyText(receiptMoney(match[4]));
  const unit = /^(?:kg|кг)$/i.test(match[2] || '') ? 'kg' : /^(?:l|л)$/i.test(match[2] || '') ? 'l' : 'pcs';
  const total = receiptLineTotal(quantity,unitPrice);
  return {index:match.index,quantity,unit,unitPrice,printedTotal,total,consistent:Boolean(total && receiptMoney(total) === receiptMoney(printedTotal))};
}
export const looksLikeReceiptMath = value => /\d(?:[\d\s.,]*)(?:[\p{L}]{1,4}\.?\s*)?[xх×*]\s*\d/iu.test(value);
export function receiptItemMathIssue(item) {
  const calculated = receiptMoney(receiptLineTotal(item.quantity,item.unitPrice));
  return !calculated || receiptMoney(item.total) !== calculated || (!item.priceReviewed && (item.mathUncertain || item.printedTotal !== undefined && receiptMoney(item.printedTotal) !== calculated));
}
export const receiptItemIssue = item => !validReceiptName(item.name) || receiptItemMathIssue(item);
const totalLabel = /(?:\b(?:grand\s+total|total(?:ul)?(?:\s+(?:de\s+plata|lei))?|amount\s+due|all\s+price|suma\s+totala)\b|итого|всего|к\s+оплате|合计|总计|应付)/i;
const excludedTotal = /sub\s*total|reduc|discount|econom|скид|сэконом|tva|vat|tax|ндс|brut|rest\b|change|cash|numerar|налич|сдач|card|карта|subtotal|小计|优惠|找零|税/i;
const moneyTokens = line => [...line.matchAll(/(?<![\p{L}\d])\d+(?:[ \u00a0.,]\d{3})*[.,]\d{2}(?!\d)/gu)];
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
    const label = normalizeReceiptText(lines[index]);
    if (!totalLabel.test(label) || excludedTotal.test(label)) continue;
    const matches = moneyTokens(lines[index]);
    const next = lines[index + 1] || '';
    // A wrapped amount is accepted only on an otherwise numeric line.
    const wrapped = !matches.length && /^\s*\d[\d\s.,]*\s*$/.test(next) ? moneyTokens(next) : [];
    const amounts = matches.length ? matches : wrapped;
    if (amounts.length === 1) candidates.push({ amount: receiptMoney(amounts[0][0]), evidence: lines[index] + (wrapped.length ? `\n${next}` : '') });
    else if (!amounts.length) {
      const integer = lines[index].match(/(?:\s|:)(\d+)\s*$/);
      if (integer) candidates.push({ amount: receiptMoney(integer[1]), evidence: lines[index] });
    }
  }
  const unique = [...new Set(candidates.map(item => item.amount).filter(item => item > 0))];
  const total = unique.length === 1 ? moneyText(unique[0]) : '';
  const normalized = normalizeReceiptText(rawText);
  const explicitCurrencies = [...new Set([
    [/\bmdl\b|moldova|moldretail|\bidno\b/i, 'MDL'], [/\busd\b|\bus\$/i, 'USD'],
    [/\beur\b|(?<!\p{L})€(?!\p{L})/iu, 'EUR'], [/\brub\b|₽|руб/i, 'RUB'], [/\bcny\b|\brmb\b|人民币/i, 'CNY'], [/\bron\b/i, 'RON'],
  ].filter(([pattern]) => pattern.test(normalized)).map(([,code]) => code))];
  let dateKey = '';
  const dateMatch = String(rawText).match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b|\b(\d{4})[./-](\d{2})[./-](\d{2})\b/);
  if (dateMatch) dateKey = dateMatch[1] ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : `${dateMatch[4]}-${dateMatch[5]}-${dateMatch[6]}`;
  const items = [];
  let pending = [];
  for (const line of lines) {
    const normalizedLine = normalizeReceiptText(line);
    if (totalLabel.test(normalizedLine) && !excludedTotal.test(normalizedLine)) break;
    if (/^[>\s]*(?:sub\s*total\b|reduc\w*\b|discount\b|скидка|подытог|промежуточ|brut\b|numerar\b|cash\b|rest\b|change\b|小计|优惠|找零)/iu.test(normalizedLine)) { pending = []; continue; }
    if (/casier|cashier|idno|idnp|\binr\b|\btva\b|\bvat\b|str\.|s\.r\.l|\bbon\b|\btelefon\b|\btel\b/i.test(normalizedLine)) { pending = []; continue; }
    const multiplication = receiptMath(line);
    const amounts = moneyTokens(line);
    const last = amounts.at(-1);
    if (multiplication || last && /^\s*[^\d]{0,12}$/i.test(line.slice(last.index + last[0].length))) {
      let name = multiplication ? line.slice(0, multiplication.index).trim() : line.slice(0, last.index).trim();
      name = cleanReceiptName(name);
      if (!validReceiptName(name) || /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name)) name = cleanReceiptName([...pending.filter(validReceiptName), /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name) ? name : ''].filter(Boolean).join(' '));
      const amount = multiplication ? multiplication.printedTotal : moneyText(receiptMoney(last[0]));
      const quantity = multiplication?.quantity || '1', unit = multiplication?.unit || 'pcs', unitPrice = multiplication?.unitPrice || amount;
      if (receiptMoney(amount) > 0) items.push({name: validReceiptName(name) ? name.slice(0,180) : '', quantity, unit, unitPrice, total:receiptLineTotal(quantity,unitPrice), printedTotal:amount, ...(!multiplication && looksLikeReceiptMath(line) ? {mathUncertain:true} : {})});
      pending = [];
    } else if (moneyTokens(line).length) pending = [];
    else if (/[\p{L}]/u.test(line) && !/\d{2}[:/-]\d{2}|^\s*\d{6,}/.test(line)) pending = [...pending.slice(-1), line];
  }
  return {merchant: lines.find(line => /[\p{L}]/u.test(line))?.slice(0,120) || '', dateKey, currency: explicitCurrencies.length === 1 ? explicitCurrencies[0] : '', total, items, category: receiptCategory(items), evidence: total ? candidates.find(item => item.amount === unique[0])?.evidence || '' : '', rawText: String(rawText || '').slice(0,40000), ambiguousTotal: unique.length > 1};
}
export function receiptValidation(draft, today, currencies) {
  const total = receiptMoney(draft.total);
  const invalidItem = draft.items.some(receiptItemIssue);
  const sum = draft.items.reduce((value,item) => value + (receiptMoney(receiptLineTotal(item.quantity,item.unitPrice)) || 0), 0);
  const lineMismatch = draft.items.some(receiptItemMathIssue);
  const mismatch = Boolean(draft.items.length && sum !== total);
  // The printed total is independent evidence, never proof that OCR item prices are correct.
  return { valid: total > 0 && currencies.includes(draft.currency) && validReceiptDate(draft.dateKey, today) && !invalidItem && !lineMismatch && !mismatch, total, sum, mismatch, lineMismatch };
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
