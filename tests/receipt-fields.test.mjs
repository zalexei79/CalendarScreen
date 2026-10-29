import test from 'node:test';
import assert from 'node:assert/strict';
import {extractReceiptMerchant} from '../src/features/receipts/receiptMerchant.js';
import {extractReceiptDate} from '../src/features/receipts/receiptDate.js';

test('merchant uses a plausible business header after promotions and fiscal metadata',()=>{
  assert.equal(extractReceiptMerchant('For a chance to WIN\nSee back of receipt\nSurvey Code:123456\n(Diganos en Espanol)\nACME CAFE #12\n123 Main Road\nBoston, MA 02110\nCoffee 3.00\nTOTAL 3.00'),'ACME CAFE #12');
  assert.equal(extractReceiptMerchant('Store #1234\nACME MARKET\nAlbany, NY 12077\nMilk 2.00\nTOTAL 2.00'),'ACME MARKET');
  assert.equal(extractReceiptMerchant('POS Demo System\nWelcome to ACME Cafe\n123 Main Street\nTOTAL 9.50'),'ACME Cafe');
});
test('address, city, server-only, and promotional prose are not merchant names',()=>{
  for(const text of ['123 Main Street\nAlbany, NY 12077\nServer: Jane\nMilk 2.00\nTOTAL 2.00','Follow us on Instagram\n@somehandle\nPlease save our resources\nTable:4\nCoffee 3.00\nTOTAL 3.00','See a chance to win\nrandom lower prose\nTOTAL 3.00'])assert.equal(extractReceiptMerchant(text),'');
});
test('a legal footer cannot override the visible trade name and missing stores stay missing',()=>{
  assert.equal(extractReceiptMerchant('ACME CAFE\n123 Main Road\nCoffee 3.00\nTOTAL 3.00\nPowered by Example Payments LLC'),'ACME CAFE');
  assert.equal(extractReceiptMerchant('ACME SERVICES S.R.L.\nstr. Alexandru cel Bun, nr.24\nCoffee 3.00\nTOTAL LEI 3.00'),'ACME SERVICES S.R.L.');
  assert.equal(extractReceiptMerchant('TOTAL LEI 3.00\nNUMERAR LEI 3.00\nREST 0.00',{totalLayout:true}),'');
});
test('merchant spatial bounds ignore camera blank margins and reject a footer posing as header',()=>{
  const line=(text,y0)=>({text,bbox:{x0:0,x1:200,y0,y1:y0+20}});
  assert.equal(extractReceiptMerchant('ACME CAFE\n123 Main Road\nTOTAL 3.00',{blocks:[{paragraphs:[{lines:[line('ACME CAFE',500),line('123 Main Road',530),line('TOTAL 3.00',700)]}]}]}),'ACME CAFE');
});
test('numeric dates support one-digit month/day, ISO, leap years and unambiguous year-short forms',()=>{
  for(const [text,wanted]of [['5/26/2016 12:53 PM','2016-05-26'],['19-10-2026','2026-10-19'],['23.10.26 19:16','2026-10-23'],['2024/2/29','2024-02-29'],['02/22/19 20:31','2019-02-22']])assert.equal(extractReceiptDate(text),wanted,text);
  assert.equal(extractReceiptDate('2023-02-29'),'');assert.equal(extractReceiptDate('32/14/2026'),'');
});
test('ambiguous dates require explicit country evidence and conflicting receipts stay unresolved',()=>{
  assert.equal(extractReceiptDate('Date:03/04/2026'),'');
  assert.equal(extractReceiptDate('Albany, NY 12077\nDate:03/04/2026'),'2026-03-04');
  assert.equal(extractReceiptDate('IDNO:123456\nDate:03/04/2026'),'2026-04-03');
  assert.equal(extractReceiptDate('Moldova\nDate:3/4/2026'),'2026-04-03');
  assert.equal(extractReceiptDate('2026-10-19\n2026-10-20'),'');
  assert.equal(extractReceiptDate('2026-10-19\nDate:3/4/2026'),'');
});
test('transaction date is not replaced by a promotion expiry or a return-policy date',()=>{
  assert.equal(extractReceiptDate('5/25/2017 1:00 PM\nSweepstakes ends12/31/2017'),'2017-05-25');
  assert.equal(extractReceiptDate('2026-10-19\nValid until11/30/2026'),'2026-10-19');
  assert.equal(extractReceiptDate('Expires12/31/2027'),'');
});
test('textual month dates and clocks are parsed without stealing a year from a neighbouring field',()=>{
  for(const [text,wanted]of [["Feb23'19 10:23AM",'2019-02-23'],['Roger GUESTS 4 FEB 18/17 8:19PM','2017-02-18'],['13-Jul-2018 8:53:47P','2018-07-13'],['SUN JUN 24 20:49:53 2018','2018-06-24'],['19 octombrie 2026','2026-10-19'],['19 октября2026','2026-10-19'],['19 жовтня2026','2026-10-19']])assert.equal(extractReceiptDate(text),wanted,text);
});
