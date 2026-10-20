import {normalizeProductText as normalize} from './productCatalog.js';

// Final purchase amounts only. Tax totals, tendered cash, change, item counts
// and subtotals deliberately do not belong here. A label still needs an amount
// in the same row or an otherwise numeric continuation; it is not a keyword hunt.
const groups = [
  'итог|итого|всего|всего к оплате|итого к оплате|итог к оплате|к оплате|сумма|общая сумма|общая стоимость|сумма чека|итог чека|итого по чеку|всего по чеку|сумма покупки|сумма к оплате|всего на сумму|всего оплачено|оплачено всего|итоговая сумма|полная стоимость',
  'сума|усього|всього|разом|до сплати|сума до сплати|сума до оплати|до оплати|разом до сплати|разом до оплати|загальна сума|загальна вартість|сума чека|сума покупки|всього до сплати|усього до сплати|сплачено всього',
  'total|totalul|total lei|total de plata|total spre plata|total de achitat|total general|total bon|total bon fiscal|suma|suma totala|suma de plata|suma spre plata|suma de achitat|de plata|spre plata|de achitat|valoare totala|valoarea totala|total achitat|total incasat',
  'grand total|total amount|total price|total cost|total payment|total paid|total sale|total sales|total purchase|total payable|total to pay|total incl tax|total including tax|total incl vat|total including vat|amount paid|amount payable|net payable|all price|receipt total|purchase total|sale total|order total|payment total|final total|final amount|transaction total|transaction amount',
  'gesamt|gesamtsumme|gesamtbetrag|endbetrag|endsumme|summe|zu zahlen|zahlbetrag|rechnungsbetrag|bruttobetrag',
  'total ttc|montant total|total a payer|net a payer|montant a payer|total general|somme totale',
  'importe total|total a pagar|monto total|total pagado|importe a pagar|total compra|total general',
  'totale|totale complessivo|totale da pagare|importo totale|totale documento|totale pagato|da pagare',
  'total a pagar|valor total|total pago|montante total|valor a pagar|total da compra',
  'suma|suma pln|razem|suma do zaplaty|do zaplaty|razem do zaplaty|kwota do zaplaty|wartosc brutto|suma do zapłaty|do zapłaty|razem do zapłaty|kwota do zapłaty',
  'celkem|celkem k uhrade|k uhrade|celkova castka|spolu|celkom|spolu k uhrade|celkova suma',
  'osszesen|fizetendo|vegosszeg|totaal|totaalbedrag|te betalen|eindtotaal',
  'totalt|att betala|summa|summa att betala|a betale|belop a betale|i alt|at betale|yhteensa|maksettava',
  'genel toplam|toplam|odenecek tutar|toplam tutar|tutar|ukupno|za platiti|skupaj|za placilo',
  '合计|总计|应付|应付金额|实付|实付金额|消费合计|消费总额|总金额|总额|合計|總計|應付金額|實付金額|總金額',
];
export const RECEIPT_TOTAL_LABELS = Object.freeze([...new Set(groups.flatMap(group=>group.split('|')).map(normalize))]);
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
export const finalReceiptLabel = new RegExp(`^(?:${[...RECEIPT_TOTAL_LABELS].sort((a,b)=>b.length-a.length).map(escape).join('|')})(?=$|[\\s.,:：=\\d€$₽£¥₴])`,'iu');
