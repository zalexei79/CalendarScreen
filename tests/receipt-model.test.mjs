import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt, receiptMoney, receiptLineTotal, receiptValidation, receiptCategory, receiptComment } from '../src/features/receipts/receiptModel.js';

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
