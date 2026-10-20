import {normalizeProductText as normalize} from './productCatalog.js';

// Match the whole accounting label, not a product containing "Total" or "Tax".
const finalLabel = /^(?:grand\s+total|total(?:ul)?(?:\s+(?:de\s+plata|spre\s+plata|de\s+achitat|lei|ttc))?|suma\s+totala|de\s+plata|de\s+achitat|all\s+price|net\s+payable|amount\s+paid|итог(?:о)?(?:\s+к\s+оплате)?|всего(?:\s+к\s+оплате)?|к\s+оплате|gesamt(?:summe)?|summe|montant\s+total|importe\s+total|合计|总计|应付(?:金额)?)(?=$|[\s.,:：=\d€$₽£¥])/iu;
const dueLabel = /^(?:amount\s+due|balance\s+due)(?=$|[\s:：=\d€$₽£¥])/iu;
const currencies = /\b(?:mdl|ron|lei|leu|usd|eur|rub|cny|rmb|gbp|chf|uah|pln|jpy)\b|us\$|руб\.?|[€$₽£¥]|人民币/giu;
const includedTax = /\b(?:incl(?:uded|usive)?\.?|with)\s*(?:vat|tax|tva)\b|\b(?:cu\s+tva|tva\s+inclus[ae]?)\b|с\s+ндс(?=$|\s|\d)/giu;
export function receiptTotalLine(value) {
  const text=normalize(value).replace(/^[\s*#>·|]+/u,''),label=text.match(finalLabel)||text.match(dueLabel);
  if(!label)return null;
  const tail=text.slice(label[0].length).replace(includedTax,'').replace(currencies,'').replace(/[:：=()]/g,'').replace(/^[\s.,·•]+/u,'').trim();
  // A fiscal total may wrap, but arbitrary product words and percent summaries
  // are not final-total labels. Signs remain available for refund detection.
  if(tail&&!/^[+\-−]?\s*\d[\d\s.,'’]*$/.test(tail))return null;
  return {role:dueLabel.test(text)?'due':'final',amount:tail,evidence:String(value)};
}

export function receiptNonItemLine(value) {
  const text=normalize(value).replace(/^[>\s*#]+/u,'');
  return /^(?:sub\s*total\b|подытог|промежуточ|reduc\w*\b|discount\b|coupon\b|voucher\s+(?:used|redeemed)\b|скидк|экономия|economii\b|savings\b|brut\b|net\s+total\b|numerar\b|cash\b|rest\b|change\b|card\b|visa\b|mastercard\b|debit\b|credit\b|payment\b|paid\b|tendered\b|налич|безнал|сдач|оплата|карта\b|tva\b|vat\b|tax(?:es)?\b|ндс\b|service\s+charge\b|tip\b|gratuity\b|rounding\b|rotunjire\b|округление|обслуживание|чаевые|loyalty\b|bonus\b|points\b|балл|小计|优惠|找零|税|支付|现金)/iu.test(text);
}

export function receiptDocumentIssue(lines) {
  const normalized=lines.map(normalize);
  // Receipt headings and operation rows only: a returns policy in a footer is
  // not evidence that the purchase itself was a refund.
  if(normalized.some(line=>/^(?:refund(?:\s+receipt)?|return\s+receipt|credit\s+note|bon\s+(?:de\s+)?retur|retur(?:\s+marfa)?|возврат(?:\s+(?:прихода|товара))?|чек\s+возврата|сторно|退货|退款)\s*(?:[:#№\d-].*)?$/iu.test(line)))return 'refund';
  if(normalized.some(line=>/^(?:pro\s*forma(?:\s+invoice)?|quotation|estimate|oferta|deviz|счет\s+на\s+оплату|счёт\s+на\s+оплату|предварительный\s+чек|предчек|нефискальный\s+чек|не\s+является\s+(?:кассовым|фискальным)\s+чеком|not\s+a\s+(?:fiscal|tax)\s+receipt|报价单)\s*(?:[:#№\d-].*)?$/iu.test(line)))return 'unpaid';
  if(lines.some(line=>receiptTotalLine(line)?.amount.match(/^[-−]/)))return 'refund';
  return '';
}

export function receiptSignature(value) {
  const lines=String(value||'').split(/\r?\n/);
  return lines.some(line=>receiptTotalLine(line)||receiptDocumentIssue([line])||/\bidno\b|bon\s+fiscal|fiscal\s+receipt|кассовый\s+чек|(?:чек|receipt)\s*[#№n]\s*\d|\bkkm\b|ккм|инн\s*\d|销售小票/iu.test(normalize(line)));
}
