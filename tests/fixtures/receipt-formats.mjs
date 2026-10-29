// Synthetic OCR text, not a photo dataset or a claim of universal OCR accuracy.
// Amounts/names vary deliberately; the supplied real photo has a separate case.
const receipt=(body,extra='')=>`CORNER SHOP\nUSD\n${body}\n19-10-2026\n${extra}`;
export const receiptFormats=[
 {id:'plain-price',text:receipt('Milk 6.50\nBread 3.25\nTOTAL 9.75'),total:'9.75',count:2,valid:true},
 {id:'integer-factors',text:receipt('Screws\n4*9=36\nTOTAL 36'),total:'36.00',count:1,valid:true},
 {id:'at-price',text:receipt('Coffee\n3 @ 12.50 37.50\nTOTAL 37.50'),total:'37.50',count:1,valid:true},
 {id:'weighted-comma',text:receipt('Mere\n0,375 kg x 24,80 = 9,30\nTOTAL 9,30'),total:'9.30',count:1,valid:true},
 {id:'weighted-four-decimals',text:receipt('Cheese\n0.1250 kg x 10.20 = 1.28\nTOTAL 1.28'),total:'1.28',count:1,valid:true},
 {id:'litres',text:receipt('Water\n1.25 l x 2.40 = 3.00\nTOTAL 3.00'),total:'3.00',count:1,valid:true},
 {id:'integer-printed-as-decimal',text:receipt('Soap\n2.000 pcs x 4.90 = 9.80\nTOTAL 9.80'),total:'9.80',count:1,valid:true},
 {id:'equation-wrap-result',text:receipt('Tea\n2 x 7.80 =\n15.60\nTOTAL 15.60'),total:'15.60',count:1,valid:true},
 {id:'equation-wrap-price',text:receipt('Tea\n2 x\n7.80 = 15.60\nTOTAL 15.60'),total:'15.60',count:1,valid:true},
 {id:'price-spaced-thousands',text:receipt('Laptop\n2 x 1 234.56 = 2 469.12\nTOTAL 2 469.12'),total:'2469.12',count:1,valid:true},
 {id:'free-gift',text:receipt('Coffee 12.00\nGift\n1 x 0.00 = 0.00\nTOTAL 12.00'),total:'12.00',count:2,valid:true},
 {id:'total-tax-included',text:receipt('Shirt 24.00\nTOTAL (incl VAT) 24.00\nVAT 4.00'),total:'24.00',count:1,valid:true},
 {id:'total-cyrillic-included-tax',text:receipt('Хлеб 6.20\nИТОГО с НДС 6.20\nНДС 0.40'),total:'6.20',count:1,valid:true},
 {id:'total-romanian-included-tax',text:receipt('Pâine 7.10\nTOTAL CU TVA 7.10\nTVA 0.53'),total:'7.10',count:1,valid:true},
 {id:'wrapped-currency-total',text:receipt('Cheese 42.90\nGRAND TOTAL\nUSD 42.90'),total:'42.90',count:1,valid:true},
 {id:'wrapped-integer-total',text:receipt('Flowers\n7 x 6 = 42\nTOTAL\n42'),total:'42.00',count:1,valid:true},
 {id:'paid-receipt-zero-balance',text:receipt('Boots 65.00\nTOTAL 65.00\nAMOUNT DUE 0.00'),total:'65.00',count:1,valid:true},
 {id:'split-payment',text:receipt('Jacket 125.00\nTOTAL 125.00\nCASH 50.00\nCARD 75.00\nCHANGE 0.00'),total:'125.00',count:1,valid:true},
 {id:'cash-larger-than-total',text:receipt('Bread 8.00\nTOTAL 8.00\nCASH 100.00\nCHANGE 92.00'),total:'8.00',count:1,valid:true},
 {id:'payment-before-total',text:receipt('Milk 10.00\nVISA 10.00\nTOTAL 10.00'),total:'10.00',count:1,valid:true},
 {id:'bonus-summary',text:receipt('Juice 15.00\nPoints 150.00\nLoyalty 5.00\nTOTAL 15.00'),total:'15.00',count:1,valid:true},
 {id:'product-total-brand',text:receipt('Total cereal 8.00\nTOTAL ITEMS 1\nTOTAL 8.00'),total:'8.00',count:1,valid:true},
 {id:'discount-after-total-informational',text:receipt('Coffee 18.00\nTOTAL 18.00\nDiscount Total -2.00'),total:'18.00',count:1,valid:true},
 {id:'discount-needs-net-details',text:receipt('Coffee 20.00\nDiscount -2.00\nTOTAL 18.00'),total:'18.00',count:1,valid:false,totalOnly:true},
 {id:'percent-discount-never-subtract-percent-as-money',text:receipt('Towel 40.00\nDiscount 10%\nTOTAL 36.00'),total:'36.00',count:1,valid:false,totalOnly:true},
 {id:'added-tax-needs-review',text:receipt('Meal 30.00\nTax 3.00\nTOTAL 33.00'),total:'33.00',count:1,valid:false,totalOnly:true},
 {id:'tip-and-service',text:receipt('Lunch 50.00\nService charge 5.00\nTip 2.00\nTOTAL 57.00'),total:'57.00',count:1,valid:false,totalOnly:true},
 {id:'rounding',text:receipt('Coffee 12.97\nRounding 0.03\nTOTAL 13.00'),total:'13.00',count:1,valid:false,totalOnly:true},
 {id:'bottle-deposit-is-visible-row',text:receipt('Beer 6.00\nBottle deposit 0.50\nTOTAL 6.50'),total:'6.50',count:2,valid:true},
 {id:'table-without-operator',text:receipt('Apples 2 3.00 6.00\nTOTAL 6.00'),total:'6.00',count:1,valid:false,totalOnly:true},
 {id:'table-integer-prices',text:receipt('Apples 2 3 6.00\nTOTAL 6.00'),total:'6.00',count:1,valid:false,totalOnly:true},
 {id:'unknown-quantity',text:receipt('Bread\nbuc x 8.00 = 8.00\nTOTAL 8.00'),total:'8.00',count:1,valid:false,totalOnly:true},
 {id:'reverse-factors-without-labels',text:receipt('Coffee\n12.50 x 3 = 37.50\nTOTAL 37.50'),total:'37.50',count:1,valid:false,totalOnly:true},
 {id:'fuel-price-more-than-two-decimals',text:receipt('Fuel\n1 l x 19.999 = 20.00\nTOTAL 20.00'),total:'20.00',count:1,valid:false,totalOnly:true},
 {id:'missing-total-not-item-total',text:receipt('Milk 12.00'),total:'',count:1,valid:false},
 {id:'conflicting-totals',text:receipt('Tea 15.00\nTOTAL 15.00\nTOTAL 18.00'),total:'',count:1,valid:false},
 {id:'zero-receipt',text:receipt('Gift 0.00\nTOTAL 0.00'),total:'0.00',count:1,valid:false},
 {id:'refund-heading',text:receipt('REFUND RECEIPT\nShoes 80.00\nTOTAL 80.00'),total:'80.00',count:1,valid:false,issue:'refund'},
 {id:'negative-grand-total',text:receipt('Shoes 80.00\nTOTAL -80.00'),total:'',count:1,valid:false,issue:'refund'},
 {id:'romanian-return',text:receipt('BON DE RETUR\nPâine 4.00\nTOTAL 4.00'),total:'4.00',count:1,valid:false,issue:'refund'},
 {id:'proforma',text:receipt('PRO FORMA INVOICE\nMonitor 200.00\nTOTAL 200.00'),total:'200.00',count:1,valid:false,issue:'unpaid'},
 {id:'russian-prebill',text:receipt('ПРЕДЧЕК\nКофе 7.00\nИТОГ 7.00'),total:'7.00',count:1,valid:false,issue:'unpaid'},
 {id:'returns-policy-is-not-refund',text:receipt('Shirt 25.00\nTOTAL 25.00','Refunds within 14 days'),total:'25.00',count:1,valid:true},
 {id:'two-receipts-one-photo',text:receipt('BON FISCAL\nTea 15.00\nTOTAL 15.00\nBON FISCAL\nSoap 15.00\nTOTAL 15.00'),total:'15.00',count:1,valid:false,issue:'multipleReceipts'},
 {id:'ambiguous-lei',text:'MAGAZIN\nPaine 7.10\nTOTAL LEI 7.10\n19-10-2026',total:'7.10',count:1,valid:false,currency:''},
 {id:'mixed-currency',text:receipt('Milk 10.00\nTOTAL USD 10.00\nPaid EUR 9.00'),total:'10.00',count:1,valid:false,currency:''},
 {id:'expiry-is-not-purchase-date',text:receipt('Milk 10.00\nTOTAL 10.00','Expires 20-10-2026'),total:'10.00',count:1,valid:true,date:'2026-10-19'},
 {id:'invalid-day',text:'SHOP\nUSD\nMilk 10.00\nTOTAL 10.00\n30-02-2026',total:'10.00',count:1,valid:false},
 {id:'unambiguous-us-date',text:'SHOP\nUSD\nMilk 10.00\nTOTAL 10.00\n10/19/2026',total:'10.00',count:1,valid:true,date:'2026-10-19'},
 {id:'future-date',text:'SHOP\nUSD\nMilk 10.00\nTOTAL 10.00\n21-10-2026',total:'10.00',count:1,valid:false},
];

// Ground truth transcribed from the user's construction receipt, photo 4.
export const constructionReceipt=`ООО "СуперЧек.ru"
Чек № 4201
Кассир: Иванов
1.Кирпич пустотелый одинарный М-150
800 X 10.22
Стоимость..................8176.00
2.Цемент ПЦ-400 Д 20 (мешках)
Стоимость..................5400.00
3.Щебень фракция 20х40 т.
5 X 480.00
Стоимость..................2400.00
4.Гвозди жидкие/ 310 мл
4 X 163.00
Стоимость..................652.00
Всего..................16628.00
ККМ 00000000 ИНН 000000000000
14.03.07 15:44 ИВАНОВ
ПРОДАЖА №2890
1 =16628.00
ИТОГ =16628.00
НАЛИЧНЫМИ =16628.00`;
