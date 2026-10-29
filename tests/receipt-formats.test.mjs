import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptFormats,constructionReceipt} from './fixtures/receipt-formats.mjs';
import {parseReceiptPhoto} from '../src/features/receipts/receiptPhoto.js';
import {receiptValidation,receiptComment} from '../src/features/receipts/receiptModel.js';
import {readSavedReceipt} from '../src/features/receipts/receiptHistory.js';
const today='2026-10-20',context={today,defaultCurrency:'MDL',defaultDateKey:today};
for(const scenario of receiptFormats)test(`receipt format: ${scenario.id}`,()=>{
 const draft=parseReceiptPhoto(scenario.text,context);
 assert.equal(draft.kind,'receipt','a receipt cannot silently become an isolated amount');
 assert.equal(draft.total,scenario.total);assert.equal(draft.items.length,scenario.count);
 if('currency'in scenario)assert.equal(draft.currency,scenario.currency);
 if('date'in scenario)assert.equal(draft.dateKey,scenario.date);
 if(scenario.issue){assert.equal(draft.documentIssue,scenario.issue);assert.equal(receiptValidation({...draft,items:[],currency:'USD',dateKey:today,total:'100.00'},today,['USD']).valid,false,'total-only cannot disguise a non-purchase document');}
 assert.equal(receiptValidation(draft,today,['USD','MDL','EUR']).valid,scenario.valid);
 if(scenario.totalOnly)assert.equal(receiptValidation({...draft,items:[]},today,['USD','MDL','EUR']).valid,true,'verified grand total remains available without invented adjustments');
 if(scenario.valid){const saved=readSavedReceipt(receiptComment(draft),'USD');assert.ok(saved);assert.equal(saved.items.length,draft.items.length);}
});
test('real construction receipt: ИТОГ, dotted leaders, two-line item amounts and legacy date',()=>{
 const draft=parseReceiptPhoto(constructionReceipt,context);
 assert.equal(draft.kind,'receipt');assert.equal(draft.total,'16628.00');assert.equal(draft.dateKey,'2007-03-14');assert.equal(draft.currency,'','Russian text does not prove the payment currency');
 assert.deepEqual(draft.items.map(({quantity,unitPrice,total})=>[quantity,unitPrice,total]),[['800','10.22','8176.00'],['1','5400.00','5400.00'],['5','480.00','2400.00'],['4','163.00','652.00']]);
 assert.equal(receiptValidation({...draft,currency:'RUB'},today,['RUB']).valid,true);
});
test('label/decimal/currency variants preserve the same independently printed total',()=>{
 const labels=['ИТОГ','ИТОГО','ВСЕГО','К ОПЛАТЕ','TOTAL','TOTAL DE PLATĂ','DE ACHITAT','SUMA TOTALĂ','GRAND TOTAL','AMOUNT DUE','NET PAYABLE','GESAMT','MONTANT TOTAL','TOTAL TTC','IMPORTE TOTAL','合计','总计','应付金额'];
 const amounts=['1234.56','1 234,56','1,234.56','1.234,56',"1’234.56"];
 for(const label of labels)for(const amount of amounts){const draft=parseReceiptPhoto(`SHOP\nUSD\n${label}: ${amount}\n19-10-2026`,context);assert.equal(draft.kind,'receipt',label);assert.equal(draft.total,'1234.56',`${label} ${amount}`);}
});
test('long receipt retains every row and ignores payment amounts larger than the total',()=>{
 const rows=Array.from({length:150},(_,index)=>`Product ${index+1}\n2 pcs x 1.15 = 2.30`);
 const draft=parseReceiptPhoto(`SHOP\nUSD\n${rows.join('\n')}\nTOTAL 345.00\nCASH 500.00\nCHANGE 155.00\n19-10-2026`,context);
 assert.equal(draft.items.length,150);assert.equal(draft.total,'345.00');assert.equal(receiptValidation(draft,today,['USD']).valid,true);
});
test('unhandled explicit units stay flagged without blocking an independent receipt total',()=>{
 for(const unit of ['g','ml','lb']){
  const draft=parseReceiptPhoto(`SHOP\nUSD\nProduct\n250 ${unit} x 0.02 = 5.00\nTOTAL 5.00\n19-10-2026`,context);
  assert.equal(draft.items[0].mathUncertain,true);assert.equal(receiptValidation(draft,today,['USD']).valid,true);
 }
});

test('final-total phrases across regions survive wrapped amounts, leaders and larger cash/tax figures',()=>{
 const labels=['ОБЩАЯ СУММА','ИТОГОВАЯ СУММА','ИТОГО ПО ЧЕКУ','СУММА К ОПЛАТЕ','СУММА ПОКУПКИ','ВСЕГО НА СУММУ','ЗАГАЛЬНА ВАРТІСТЬ','РАЗОМ ДО СПЛАТИ','УСЬОГО ДО СПЛАТИ','СУМА ЧЕКА','SUMA SPRE PLATĂ','TOTAL BON FISCAL','VALOAREA TOTALĂ','TOTAL ÎNCASAT','RECEIPT TOTAL','TOTAL AMOUNT','TOTAL INCLUDING TAX','TOTAL PAYABLE','FINAL AMOUNT','TRANSACTION TOTAL','GESAMTBETRAG','ZU ZAHLEN','RECHNUNGSBETRAG','TOTAL À PAYER','NET À PAYER','SOMME TOTALE','IMPORTE A PAGAR','TOTAL PAGADO','TOTALE DOCUMENTO','IMPORTO TOTALE','VALOR TOTAL','TOTAL DA COMPRA','RAZEM DO ZAPŁATY','CELKEM K ÚHRADĚ','CELKOVÁ SUMA','FIZETENDŐ','TOTAALBEDRAG','ATT BETALA','YHTEENSÄ','GENEL TOPLAM','ZA PLATITI','应付金额','實付金額'];
 for(const label of labels)for(const body of[`${label}...695,50`,`${label}\n695.50 EUR`,`${label}: EUR 695.50`]){
  const draft=parseReceiptPhoto(`SHOP\n${body}\nCASH 1000.00\nCHANGE 304.50\nVAT 115.92\n19-10-2026`,context);assert.equal(draft.total,'695.50',body);assert.equal(draft.kind,'receipt');
 }
 for(const label of['TOTAL VAT','TOTAL TAX','TOTAL DISCOUNT','TOTAL ITEMS','TOTAL WEIGHT','TOTAL BEFORE TAX','СУММА НДС','СУММА СКИДКИ','ОБЩАЯ СУММА НАЛОГА','СУМА ПОДАТКУ','СУМА ПДВ','TOTAL TVA','TOTAL ECONOMII','SUBTOTAL','SUB TOTAL']){
  const draft=parseReceiptPhoto(`SHOP\n${label} 9999.00\nTOTAL 695.50\n19-10-2026`,context);assert.equal(draft.total,'695.50',label);
 }
});

test('discount signs and damaged service rows do not invent purchases, merchants or refunds',()=>{
 const text='ПН 304872104175\nЧН 384872104170\nКаса 3\nЯблуко зелене\n1.726 x 14.39 = 24.84 A\nЗнижка\nid -0.09 A\n\u22120.03 A\nСума 695.50\nПДВ 20% 115.92';
 const draft=parseReceiptPhoto(text,context);assert.equal(draft.total,'695.50');assert.equal(draft.documentIssue,'');assert.equal(draft.items.length,1);assert.equal(draft.merchant,'');assert.equal(draft.items[0].printedTotal,'24.84');
 const missing=parseReceiptPhoto('SHOP\nMDL\nMilk 100.00\nBread 131.71',context),checked=receiptValidation(missing,today,['MDL']);
 assert.equal(missing.total,'');assert.equal(checked.sum,23171);assert.equal(checked.total,null);assert.equal(checked.mismatch,false,'unknown total is not a zero-valued receipt');assert.equal(checked.valid,false);
 const recovered=parseReceiptPhoto('SHOP\nMDL\nMilk 100.00\nBread 131.71\nОБЩАЯ СУММА 695.50\n19-10-2026',context);assert.equal(recovered.total,'695.50');assert.equal(receiptValidation({...recovered,items:[]},today,['MDL']).valid,true,'verified total is saveable without unverified detail rows');
});
