import test from 'node:test';
import assert from 'node:assert/strict';
import {RECEIPT_PRODUCT_TYPES,classifyProduct,searchProductTypes} from '../src/features/receipts/productCatalog.js';
import {receiptProduct,receiptCategory,receiptComment} from '../src/features/receipts/receiptModel.js';
import {readSavedReceipt,receiptFromEntry,receiptFingerprint} from '../src/features/receipts/receiptHistory.js';
import {readProductMemory,rememberProductType,recalledProductType} from '../src/features/receipts/productMemory.js';
import {legacyReceiptComment as legacyComment} from './fixtures/receipt-history.mjs';
test('saved legacy receipts become structured rows without rewriting historic totals',()=>{
 const entry={pnl:-151.85,currency:'MDL',platform:'Manual',comment:legacyComment};
 const receipt=receiptFromEntry(entry);assert.equal(receipt.items.length,5);assert.equal(receipt.total,'151.85');assert.equal(receipt.sum,'131.85');assert.equal(receipt.difference,'20.00');assert.equal(receipt.mismatch,true);assert.equal(receipt.lineMismatch,true);
 assert.equal(receiptProduct(receipt.items[0].name).title,'Пиво BIERMANN');assert.equal(entry.comment,legacyComment);assert.equal(entry.pnl,-151.85);
});
test('new readable receipt format round-trips originals, chosen types, weighted quantities and currencies',()=>{
 const draft={merchant:'Shop',currency:'MDL',items:[{name:'XYZ special 400ml',productType:'shampoo',quantity:'2',unit:'pcs',unitPrice:'10.00',total:'20.00'},{name:'Mere',quantity:'0.125',unit:'kg',unitPrice:'10.20',total:'1.28'}]};
 const comment=receiptComment(draft,'ru');assert.match(comment,/🧾 Shop/);assert.match(comment,/Шампунь/);assert.doesNotMatch(comment,/\{"/);
 const restored=readSavedReceipt(comment,'MDL');assert.equal(restored.items[0].name,'XYZ special 400ml');assert.equal(restored.items[0].productType,'shampoo');assert.equal(restored.items[1].unit,'kg');assert.equal(restored.items[1].quantity,'0.125');assert.equal(receiptFingerprint(restored),receiptFingerprint(draft));
 const legacy=readSavedReceipt(legacyComment.replace('2 × 23.95 = 39.90','2 × 29.95 = 59.90'),'MDL');assert.equal(receiptFingerprint(readSavedReceipt(receiptComment(legacy),'MDL')),receiptFingerprint(legacy),'duplicate detection survives a valid receipt format upgrade');
 assert.equal(readSavedReceipt(comment,'EUR'),null);
 assert.equal(receiptFromEntry({pnl:-25.50,currency:'MDL',comment:receiptComment({merchant:'Store',items:[],currency:'MDL'})}).total,'25.50');
});
test('ordinary comments, extra personal notes, trading entries and mixed-currency receipts are not reinterpreted',()=>{
 for(const comment of ['Обычный комментарий','Молоко · 1 × 10.00 = 10.00 MDL','🛒 Купил продукты на неделю',legacyComment+'\nПозвонить завтра'])assert.equal(readSavedReceipt(comment,'MDL'),null);
 assert.equal(receiptFromEntry({pnl:151.85,currency:'MDL',comment:legacyComment}),null);
 assert.equal(receiptFromEntry({pnl:-151.85,currency:'MDL',platform:'cTrader',comment:legacyComment}),null);
 assert.equal(readSavedReceipt(legacyComment.replace('= 7.10 MDL','= 7.10 EUR'),'MDL'),null);
});
test('partial and contradictory receipt rows round-trip without inventing names, factors or equations',()=>{
 const draft={merchant:'SHOP',currency:'RUB',total:'16628.00',items:[
  {name:'Кирпич',quantity:'800',unit:'pcs',unitPrice:'10.22',total:'8176.00',printedTotal:'76.00'},
  {name:'',quantity:'',unit:'pcs',unitPrice:'',total:'',printedTotal:'5400.00'},
  {name:'buc x 2 =',quantity:'4',unit:'pcs',unitPrice:'',total:''},
  {name:'Молоко',quantity:'1',unit:'pcs',unitPrice:'0.00',total:'0.00',printedTotal:'0.00'},
 ]};
 const comment=receiptComment(draft),restored=readSavedReceipt(comment,'RUB');
 assert.match(comment,/Кирпич · 800 pcs @ 10.22 · 76.00 RUB/);assert.doesNotMatch(comment,/800 × 10.22 = 76.00/);assert.doesNotMatch(comment,/\{"/);
 assert.equal(restored.items.length,4);assert.equal(restored.items[0].total,'76.00');assert.equal(restored.items[0].printedTotal,'76.00');assert.equal(restored.items[0].mathUncertain,true);
 assert.equal(restored.items[1].name,'');assert.equal(restored.items[1].quantity,'');assert.equal(restored.items[1].unitPrice,'');assert.equal(restored.items[1].total,'5400.00');
 assert.equal(restored.items[2].name,'buc x 2 =');assert.equal(restored.items[2].total,'');assert.equal(restored.items[3].total,'0.00');
 assert.equal(receiptFingerprint(restored),receiptFingerprint(draft));assert.equal(readSavedReceipt(comment,'MDL'),null);
 const entry={pnl:-16628,currency:'RUB',platform:'Manual',comment},receipt=receiptFromEntry(entry);assert.equal(receipt.total,'16628.00');assert.equal(receipt.sum,'5476.00');assert.equal(receipt.difference,'11152.00');assert.equal(receipt.mismatch,true);assert.equal(receipt.lineMismatch,true);assert.equal(entry.pnl,-16628);
 const totalOnly=receiptFromEntry({...entry,comment:receiptComment({...draft,items:[]})});assert.equal(totalOnly.total,'16628.00');assert.deepEqual(totalOnly.items,[]);
 assert.equal(readSavedReceipt(comment.replace(/^🧾 SHOP/,'SHOP'),'RUB'),null,'relaxed detail grammar must be explicitly marked');
});
test('user-edited factors choose the edited amount while unknown amounts stay absent',()=>{
 const draft={merchant:'Shop',currency:'MDL',items:[{name:'Bere',quantity:'2',unitPrice:'29.95',total:'59.90',printedTotal:'39.90',priceReviewed:true},{name:'Unknown',quantity:'',unitPrice:'',total:''}]};
 const comment=receiptComment(draft),restored=readSavedReceipt(comment,'MDL');assert.match(comment,/2 × 29.95 = 59.90 MDL/);assert.equal(restored.items[0].total,'59.90');assert.equal(restored.items[1].total,'');assert.equal(receiptFingerprint(restored),receiptFingerprint(draft));
});
test('one shared product catalog covers everyday purchases across groups and scripts without making financial categories',()=>{
 assert.ok(RECEIPT_PRODUCT_TYPES.length>=80);
 for(const [name,id] of [['sampon NIVEA','shampoo'],['шампунь 400мл','shampoo'],['洗发水','shampoo'],['pantaloni jeans','trousers'],['куриная грудка','chicken'],['cartofi','potatoes'],['mere rosii','apples'],['Peanut butter','nut_spread'],['pasta de dinti','toothpaste'],['paracetamol','medicine'],['benzina AI95','fuel'],['кабель USB','electronics'],['тетрадь','stationery'],['hrana pisici','pet_food']])assert.equal(classifyProduct(name)?.id,id,name);
 assert.equal(classifyProduct('Waterfall butterfly'),null,'substring matches do not invent products');
 assert.equal(classifyProduct('Mystery 123'),null);
 assert.equal(receiptCategory([{name:'milk',total:'5.00'},{name:'шампунь',total:'30.00'}]),'Покупки');
 assert.ok(searchProductTypes('шампунь').some(type=>type.id==='shampoo'));assert.ok(searchProductTypes('haine','ro').some(type=>type.id==='clothes'));
});
test('explicit type corrections are bounded, account scoped, reversible and safe when storage is unavailable',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const memory=rememberProductType('a','XYZ crème 400ml','shampoo',storage);
 assert.equal(recalledProductType(memory,'xyz creme 400ml'),'shampoo');assert.deepEqual(readProductMemory('b',storage),{});
 assert.equal(receiptProduct('XYZ crème 400ml','en',recalledProductType(memory,'xyz creme 400ml')).type,'shampoo');
 assert.equal(recalledProductType(memory,'XYZ crème 400g'),'','similar sizes do not inherit an unrelated correction');
 assert.equal(recalledProductType(rememberProductType('a','XYZ crème 400ml','',storage),'XYZ crème 400ml'),'');
 const broken={getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}};
 assert.deepEqual(readProductMemory('a',broken),{});assert.equal(rememberProductType('a','XYZ','shampoo',broken).xyz,'shampoo');
});
