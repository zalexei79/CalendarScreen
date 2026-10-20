import {normalizeProductText as normalize} from './productCatalog.js';
import {finalReceiptLabel} from './receiptTotalLabels.js';

// Match the whole accounting label, not a product containing "Total" or "Tax".
const dueLabel = /^(?:amount\s+due|balance\s+due)(?=$|[\s:：=\d€$₽£¥])/iu;
const currencies = /\b(?:mdl|ron|lei|leu|usd|eur|rub|cny|rmb|gbp|chf|uah|pln|jpy)\b|us\$|руб\.?|грн\.?|[€$₽£¥₴]|人民币/giu;
const includedTax = /\b(?:incl(?:uded|usive)?\.?|with)\s*(?:vat|tax|tva)\b|\b(?:cu\s+tva|tva\s+inclus[ae]?)\b|с\s+ндс(?=$|\s|\d)/giu;
export function receiptTotalAnchor(value) {
  const text=normalize(value).replace(/^[\s*#>·|]+/u,'');
  const label=text.match(finalReceiptLabel)||text.match(dueLabel);
  if(label)return {role:dueLabel.test(text)?'due':'final',tail:text.slice(label[0].length),fuzzy:false};
  // Only known visual OCR confusions, never arbitrary edit-distance matching
  // ("Sumac" and other real product names must remain products).
  const fuzzy=text.match(/^(?:t[оo0]ta[l1i|]|[иiі][тt][оo0][гr](?:[оo0])?|[вb][сc][еe][гr][оo0]|[сc\[][уyчu](?:[мm]|r[nm])[аa]|с\s+у\s+м\s+а|и\s+т\s+о\s+г(?:\s+о)?|t\s+o\s+t\s+a\s+l)(?=$|[\s.,:：=\d€$₽£¥₴])/iu);
  return fuzzy?{role:'final',tail:text.slice(fuzzy[0].length),fuzzy:true}:null;
}
export function receiptTotalLine(value) {
  const label=receiptTotalAnchor(value);
  if(!label||label.fuzzy)return null;
  const tail=label.tail.replace(includedTax,'').replace(currencies,'').replace(/[:：=()]/g,'').replace(/^[\s.,·•]+/u,'').trim();
  // A fiscal total may wrap, but arbitrary product words and percent summaries
  // are not final-total labels. Signs remain available for refund detection.
  if(tail&&!/^[+\-−]?\s*\d[\d\s.,'’]*$/.test(tail))return null;
  return {role:label.role,amount:tail,evidence:String(value)};
}

export function receiptNonItemLine(value) {
  const text=normalize(value).replace(/^[>\s*#]+/u,'');
  return /^(?:sub\s*total\b|подытог|промежуточ|reduc\w*\b|discount\b|coupon\b|voucher\s+(?:used|redeemed)\b|скидк|знижк|сума\s+податк|сума\s+пдв|пдв|готівк|решта|заокругл|экономия|economii\b|savings\b|brut\b|net\s+total\b|numerar\b|cash\b|rest\b|change\b|card\b|visa\b|mastercard\b|debit\b|credit\b|payment\b|paid\b|tendered\b|налич|безнал|сдач|оплата|карта\b|tva\b|vat\b|tax(?:es)?\b|ндс\b|service\s+charge\b|tip\b|gratuity\b|rounding\b|rotunjire\b|округление|обслуживание|чаевые|loyalty\b|bonus\b|points\b|балл|小计|优惠|找零|税|支付|现金)/iu.test(text);
}

export function receiptMetadataLine(value) {
  const text=normalize(value).replace(/^[\s|]+/u,'');
  return /^(?:[з3]н|пн|чн|фн|фп|іпн|рнокпп|каса|касса|касир|кассир|кас[аи]|чек\s*\d|id(?:no|np)?|inr|kkm|ккм|инн|эклз)(?=$|[\s:№#\d])/iu.test(text)||/^(?:mdl|ron|usd|eur|rub|cny|rmb|gbp|chf|uah|pln|jpy|lei|грн|руб)\.?$/iu.test(text);
}

export function receiptDocumentIssue(lines) {
  const normalized=lines.map(normalize);
  // Receipt headings and operation rows only: a returns policy in a footer is
  // not evidence that the purchase itself was a refund.
  if(normalized.some(line=>/^(?:refund(?:\s+receipt)?|return\s+receipt|credit\s+note|bon\s+(?:de\s+)?retur|retur(?:\s+marfa)?|возврат(?:\s+(?:прихода|товара))?|чек\s+возврата|сторно|退货|退款)\s*(?:[:#№\d-].*)?$/iu.test(line)))return 'refund';
  if(normalized.some(line=>/^(?:pro\s*forma(?:\s+invoice)?|quotation|estimate|oferta|deviz|счет\s+на\s+оплату|счёт\s+на\s+оплату|предварительный\s+чек|предчек|нефискальный\s+чек|не\s+является\s+(?:кассовым|фискальным)\s+чеком|not\s+a\s+(?:fiscal|tax)\s+receipt|报价单)\s*(?:[:#№\d-].*)?$/iu.test(line)))return 'unpaid';
  if(lines.some(line=>receiptTotalLine(line)?.amount.match(/^[-−]/)))return 'refund';
  const text=normalized.join(' ');
  if(/xau\s*usd|xauusd|\bmt[45]\b|metatrader|c\s*trader|\bpips\b/iu.test(text)&&/profit|balance|equity|лот|прибыл|позици|ордер/iu.test(text)||/лот[ыа]?/iu.test(text)&&/позици|ордер/iu.test(text))return 'trading';
  return '';
}

export function receiptSignature(value) {
  const lines=String(value||'').split(/\r?\n/);
  return Boolean(receiptDocumentIssue(lines))||lines.some(line=>receiptTotalAnchor(line)||/\bidno\b|bon\s+fiscal|fiscal\s+receipt|кассовый\s+чек|ф[іiи]скальн.*чек|(?:чек|receipt)\s*[#№n]\s*\d|\bkkm\b|ккм|инн\s*\d|销售小票/iu.test(normalize(line)));
}
