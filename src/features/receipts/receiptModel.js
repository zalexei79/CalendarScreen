// Receipt arithmetic uses minor units; OCR output never writes a calendar entry.
export const normalizeReceiptText = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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
const productNames = [
  [/\b(?:bere|beer)\b|пиво|啤酒/iu, ['Пиво','Beer','Bere','啤酒']],
  [/\b(?:paine|piine|bread)\b|хлеб|батон|面包/iu, ['Хлеб','Bread','Pâine','面包']],
  [/\b(?:ansoa|anchov\w*)\b|анчоус/iu, ['Анчоусы','Anchovies','Anșoa','凤尾鱼']],
  [/\b(?:arahide|peanuts?)\b|арахис/iu, ['Арахис','Peanuts','Arahide','花生']],
  [/\b(?:vobla)\b|вобла/iu, ['Вяленая вобла','Dried roach','Voblă uscată','风干鱼']],
  [/\b(?:lapte|milk)\b|молоко|牛奶/iu, ['Молоко','Milk','Lapte','牛奶']],
  [/\b(?:cafea|coffee)\b|кофе|咖啡/iu, ['Кофе','Coffee','Cafea','咖啡']],
  [/\b(?:oua|eggs?)\b|яйц|鸡蛋/iu, ['Яйца','Eggs','Ouă','鸡蛋']],
  [/\b(?:branza|cascaval|cheese)\b|сыр|奶酪/iu, ['Сыр','Cheese','Brânză','奶酪']],
  [/\b(?:apa|water)\b|вода|饮用水/iu, ['Вода','Water','Apă','饮用水']],
  [/\b(?:orez|rice)\b|\bрис\b|大米/iu, ['Рис','Rice','Orez','大米']],
  [/\b(?:ciocolata|chocolate)\b|шоколад|巧克力/iu, ['Шоколад','Chocolate','Ciocolată','巧克力']],
  [/\b(?:zahar|sugar)\b|сахар|白糖/iu, ['Сахар','Sugar','Zahăr','白糖']],
  [/\b(?:carne|meat)\b|мясо|肉/iu, ['Мясо','Meat','Carne','肉']],
  [/\b(?:peste|fish)\b|рыба|鱼/iu, ['Рыба','Fish','Pește','鱼']],
];
export function receiptProduct(value, language = 'ru') {
  const original = cleanReceiptName(value), normalized = normalizeReceiptText(original);
  if (!validReceiptName(original)) return { title:'', detail:'', original };
  const matched = productNames.find(([pattern]) => pattern.test(normalized));
  if (!matched) return { title:original, detail:'', original };
  const locale = String(language).startsWith('zh') ? 3 : ['md','ro'].includes(language) ? 2 : language === 'en' ? 1 : 0;
  const first = original.split(' ')[0];
  const brand = /^[\p{L}][\p{L}\d-]{2,23}$/u.test(first) && !matched[0].test(normalizeReceiptText(first)) && !/^(?:snack|fresh|bio)$/i.test(first) ? first : '';
  // Only show clearly printed pack sizes; do not turn OCR's "900" into "90 g".
  const size = original.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|кг|ml|мл|g|г|l|л)\b/iu)?.[0] || '';
  const symbol = ['🍺','🍞','🐟','🥜','🐟','🥛','☕','🥚','🧀','💧','🍚','🍫','🍬','🥩','🐟'][productNames.indexOf(matched)];
  return { title:[matched[1][locale],brand].filter(Boolean).join(' '), detail:size, original, symbol };
}
const vocabulary = {
  'Продукты': ['paine','piine','хлеб','батон','bread','面包','lapte','молоко','milk','牛奶','oua','яйц','eggs','carne','мясо','meat','peste','рыба','fish','vobla','ansoa','arahide','bere','пиво','beer','啤酒','fruct','овощ','фрукт','legume','apa','вода','water','branza','сыр','cheese','cafea','кофе','coffee','orez','рис','rice','paste','макарон','pasta','zahar','сахар','sugar','ulei','масло','oil','snack','ciocolat','шоколад','chocolate','食品'],
  'Здоровье': ['medicament','лекарств','medicine','paracetamol','ibuprofen','farmaci','аптек','pharmacy','药'],
  'Транспорт': ['benzina','motorina','бензин','дизель','diesel','petrol','fuel','汽油'],
  'Сигареты': ['tigari','tutun','сигарет','табак','cigarette','tobacco','香烟'],
  'Покупки': ['detergent','sapun','шампун','мыло','soap','shampoo','haine','одежд','clothing','洗发','洗衣'],
};
export function receiptCategory(names) {
  const text = normalizeReceiptText(names);
  const scores = Object.entries(vocabulary).map(([category, words]) => [category, words.filter(word => text.includes(word)).length]);
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] ? scores[0][0] : 'Другое';
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
    const multiplication = line.match(/(\d+(?:[.,]\d{1,3})?)\s*([\p{L}]{1,4}\.?)?\s*[xх×*]\s*(\d+(?:[.,]\d{2}))\s*[=:\-]?\s*(\d+(?:[.,]\d{2}))(?!\d)[^\d]{0,12}$/iu);
    const amounts = moneyTokens(line);
    const last = amounts.at(-1);
    if (multiplication || last && /^\s*[^\d]{0,12}$/i.test(line.slice(last.index + last[0].length))) {
      let name = multiplication ? line.slice(0, multiplication.index).trim() : line.slice(0, last.index).trim();
      name = cleanReceiptName(name);
      if (!validReceiptName(name) || /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name)) name = cleanReceiptName([...pending.filter(validReceiptName), /^\d+\s*(?:g|gr|kg|ml|l|г|кг)?$/i.test(name) ? name : ''].filter(Boolean).join(' '));
      const amount = multiplication ? multiplication[4] : last[0];
      const unit = /^(?:kg|кг)$/i.test(multiplication?.[2] || '') ? 'kg' : /^(?:l|л)$/i.test(multiplication?.[2] || '') ? 'l' : 'pcs';
      if (receiptMoney(amount) > 0) items.push({name: validReceiptName(name) ? name.slice(0,180) : '', quantity: multiplication?.[1].replace(',','.') || '1', unit, unitPrice: multiplication ? moneyText(receiptMoney(multiplication[3])) : moneyText(receiptMoney(amount)), total: moneyText(receiptMoney(amount))});
      pending = [];
    } else if (moneyTokens(line).length) pending = [];
    else if (/[\p{L}]/u.test(line) && !/\d{2}[:/-]\d{2}|^\s*\d{6,}/.test(line)) pending = [...pending.slice(-1), line];
  }
  return {merchant: lines.find(line => /[\p{L}]/u.test(line))?.slice(0,120) || '', dateKey, currency: explicitCurrencies.length === 1 ? explicitCurrencies[0] : '', total, items, category: receiptCategory(items.map(item => item.name).join(' ')), evidence: total ? candidates.find(item => item.amount === unique[0])?.evidence || '' : '', rawText: String(rawText || '').slice(0,40000), ambiguousTotal: unique.length > 1};
}
export function receiptValidation(draft, today, currencies) {
  const total = receiptMoney(draft.total);
  const invalidItem = draft.items.some(item => !validReceiptName(item.name) || receiptMoney(item.total) === null || receiptMoney(item.total) <= 0 || !receiptLineTotal(item.quantity, item.unitPrice));
  const sum = draft.items.reduce((value,item) => value + (receiptMoney(item.total) || 0), 0);
  const lineMismatch = draft.items.some(item => receiptMoney(receiptLineTotal(item.quantity, item.unitPrice)) !== receiptMoney(item.total));
  return { valid: total > 0 && currencies.includes(draft.currency) && validReceiptDate(draft.dateKey, today) && !invalidItem, total, sum, mismatch: Boolean(draft.items.length && sum !== total), lineMismatch };
}
export function receiptComment(draft) {
  return [draft.merchant.trim(), ...draft.items.map(item => `${item.name.trim()} · ${item.quantity}${item.unit === 'kg' ? ' kg' : item.unit === 'l' ? ' l' : ''} × ${moneyText(receiptMoney(item.unitPrice))} = ${moneyText(receiptMoney(item.total))} ${draft.currency}`)].filter(Boolean).join('\n');
}
