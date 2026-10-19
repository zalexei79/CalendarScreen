import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, receiptMoney, receiptLineTotal, receiptValidation, receiptCategory, receiptComment, receiptProduct, validReceiptName } from '../src/features/receipts/receiptModel.js';

export const sample = `MOLDRETAIL GROUP S.R.L.
rn. Floresti, sat. Sanatauca
IDNO: 1010600022460
Casier: 67702
BIERMANN Bere blonda 2.4l
2 buc x 29.95= 59.90 A
Snack 4 You Ansoa sarat uscat 80g
1 buc x 23.95= 23.95 A
BEERka Arahide cu sare 90g
1 buc x 15.95= 15.95 A
FRANZELUTA Paine GRAHAM amb.feliat
400g 1 buc x 7.10= 7.10 B
ARIS Vobla zvintata 100g
1 buc x 44.95= 44.95 A
TOTAL LEI 151.85
NUMERAR LEI 151.85
REST 0.00
BRUT A 144.75
TVA 20% 24.13
BRUT B 7.10
TVA 8% 0.53
Reducere Total - 17.00
19-10-2026 19:16
BON FISCAL`;

test('Moldovan receipt keeps exact total, items, quantity and date; does not subtract discount twice', () => {
  const receipt = parseReceipt(sample);
  assert.equal(receipt.total, '151.85'); assert.equal(receipt.currency, 'MDL');
  assert.equal(receipt.dateKey, '2026-10-19'); assert.equal(receipt.items.length, 5);
  assert.equal(receipt.items[0].quantity, '2'); assert.equal(receipt.items[0].unitPrice, '29.95');
  assert.match(receipt.items[3].name, /FRANZELUTA.*400g/);
  assert.equal(receipt.category, 'Продукты');
  assert.deepEqual(receiptValidation(receipt,'2026-10-19',['MDL']),{valid:true,total:15185,sum:15185,mismatch:false,lineMismatch:false});
  assert.match(receiptComment(receipt), /2 × 29.95 = 59.90 MDL/);
});
test('minor units and weighted goods use exact decimal arithmetic', () => {
  for (const value of ['151.85','151,85']) assert.equal(receiptMoney(value),15185);
  assert.equal(receiptMoney('1 234,56'),123456); assert.equal(receiptMoney('1,234.56'),123456);
  assert.equal(receiptMoney('1.234,56'),123456); assert.equal(receiptMoney('O.85'),null);
  assert.equal(receiptMoney('-10'),null); assert.equal(receiptMoney(''),null);
  assert.equal(receiptLineTotal('0,125','10.20'),'1.28');
  assert.equal(receiptLineTotal('2','29.95'),'59.90');
});
test('total labels across UI languages exclude subtotal, tax, discounts, cash and change', () => {
  for(const label of ['ИТОГО','ВСЕГО','К ОПЛАТЕ','TOTAL DE PLATĂ','SUMA TOTALĂ','GRAND TOTAL','AMOUNT DUE','合计','总计','应付']) {
    assert.equal(parseReceipt(`Subtotal 100.00\nTVA 20.00\n${label} 120,00\nReducere Total 17.00\nНАЛИЧНЫМИ 200.00\nСДАЧА 80.00`).total,'120.00',label);
  }
  assert.equal(parseReceipt('TOTAL LEI\n151.85').total,'151.85');
  assert.equal(parseReceipt('TOTAL 151').total,'151.00');
  assert.equal(parseReceipt('Total 97.00\nTotal 97.00').total,'97.00');
  assert.equal(parseReceipt('TOTAL 100.00\nTOTAL 120.00').total,'');
  assert.equal(parseReceipt('Subtotal 100.00\nReducere Total 17.00').total,'');
});
test('unclear currency/date/total are not silently inferred', () => {
  assert.equal(parseReceipt('TOTAL LEI 151.85').currency,'');
  assert.equal(parseReceipt('TOTAL RON 151.85').currency,'RON');
  const receipt = parseReceipt('TOTAL 151.85');
  assert.equal(receipt.dateKey,''); assert.equal(receiptValidation(receipt,'2026-10-19',['MDL']).valid,false);
  assert.equal(receiptValidation({...receipt,currency:'MDL',dateKey:'2026-02-30'},'2026-10-19',['MDL']).valid,false);
  assert.equal(receiptValidation({...receipt,currency:'MDL',dateKey:'2026-10-20'},'2026-10-19',['MDL']).valid,false);
  assert.equal(receiptValidation({...receipt,currency:'MDL',dateKey:'2026-10-19'},'2026-10-19',['MDL']).valid,true,'explicit total-only entry is possible');
});
test('editable items flag disagreement without overwriting printed total', () => {
  const receipt = parseReceipt(sample); receipt.items[0].total='60.00';
  const validation = receiptValidation(receipt,'2026-10-19',['MDL']);
  assert.equal(validation.mismatch,true); assert.equal(validation.lineMismatch,true); assert.equal(receipt.total,'151.85');
  receipt.items[0].name=''; assert.equal(receiptValidation(receipt,'2026-10-19',['MDL']).valid,false);
});
test('common products map to existing categories across languages', () => {
  for (const name of ['pâine','pîine','хлеб','bread','面包','bere','пиво','beer','lapte','молоко']) assert.equal(receiptCategory(name),'Продукты');
  assert.equal(receiptCategory('ibuprofen'),'Здоровье'); assert.equal(receiptCategory('motorina'),'Транспорт');
  assert.equal(receiptCategory('unknown product'),'Другое');
});
test('broken price rows use the previous product name, or require a name correction', () => {
  const receipt = parseReceipt('IDNO: 123\nSnack 4 You Ansoa sarat uscat 80g\nbuc x 23.95= 23.95 A\nTOTAL 23.95');
  assert.equal(receipt.items[0].name,'Snack 4 You Ansoa sarat uscat 80g');
  assert.equal(receiptProduct(receipt.items[0].name,'ru').title,'Анчоусы');
  for(const name of ['buc x 23.95=','n 1 buc x 15.9%=','1 Бис х 44.95','400g']) assert.equal(validReceiptName(name),false,name);
  const unknown=parseReceipt('IDNO: 123\nbuc x 23.95= 23.95 A\nTOTAL 23.95');
  assert.equal(unknown.items[0].name,'');
  assert.equal(receiptValidation({...unknown,dateKey:'2026-10-19',currency:'MDL'},'2026-10-19',['MDL']).valid,false);
  const mismatch=parseReceipt('IDNO: 123\nBIERMANN Bere blonda 2.4l\n2 buc x 23.95 = 39.90 A\nSUBTOTAL 39.90\nReducere Total 17.00\nTOTAL LEI 39.90');
  assert.equal(mismatch.items.length,1,'subtotal/discount lines are not purchases');
  assert.equal(mismatch.items[0].unitPrice,'23.95');assert.equal(mismatch.items[0].total,'39.90','uncertain OCR prices are never silently corrected');
  assert.equal(receiptValidation(mismatch,'2026-10-19',['MDL']).lineMismatch,true);
});
test('readable localized product titles retain brands, preserve original text and never invent sizes or prices', () => {
  const beer=receiptProduct('BIERMANN Bere blonda 2.4l','ru');
  assert.equal(beer.title,'Пиво BIERMANN');assert.equal(beer.detail,'2.4l');assert.equal(beer.original,'BIERMANN Bere blonda 2.4l');
  assert.equal(receiptProduct('BEERka Arahide cu sare 900','ru').title,'Арахис BEERka');
  assert.equal(receiptProduct('BEERka Arahide cu sare 900','ru').detail,'');
  assert.equal(receiptProduct('FRANZELUTA Paine GRAHAM 400g','ru').title,'Хлеб FRANZELUTA');
  assert.equal(receiptProduct('bere','en').title,'Beer');assert.equal(receiptProduct('хлеб','ro').title,'Pâine');
  assert.equal(receiptProduct('milk','zh-CN').title,'牛奶');
  assert.equal(receiptProduct('Mystery product 150g','ru').title,'Mystery product 150g');
  const weighted=parseReceipt('IDNO: 123\nMere\n0.125 kg x 10.20 = 1.28 A\nTOTAL 1.28');
  assert.equal(weighted.items[0].unit,'kg');assert.match(receiptComment(weighted),/0.125 kg × 10.20 = 1.28/);
});
