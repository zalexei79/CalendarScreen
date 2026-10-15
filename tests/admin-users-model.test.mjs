import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTotals, changesFor, editableFields, monthBounds, monthCells, moveMonth } from '../src/features/admin/adminUsersModel.js';
test('calendar handles leap years, Monday weeks and year transitions',()=>{
  assert.equal(monthBounds('2028-02').to,'2028-02-29');
  assert.equal(monthCells('2026-10')[3],'2026-10-01');
  assert.equal(monthCells('2026-10').filter(Boolean).length,31);
  assert.equal(moveMonth('2026-12',1),'2027-01');
  assert.equal(moveMonth('2026-01',-1),'2025-12');
  assert.throws(()=>monthBounds('2026-99'));
});
test('calendar totals never mix wallet or currencies',()=>{
  assert.deepEqual(calendarTotals([{dataset:'trades',currency:'USD',amount:-2},{dataset:'trades',currency:'EUR',amount:8},{dataset:'wallet_transactions',currency:'USD',amount:100}],'trades'),[{currency:'USD',amount:-2},{currency:'EUR',amount:8}]);
});
test('patches preserve untouched data and only allow comments on imports',()=>{
  const original={id:4,platform:'Manual',instrument:'Еда',pnl:'-5',currency:'USD',comment:''};
  assert.deepEqual(changesFor('trades',original,{...original,pnl:'-7'}),{pnl:-7});
  assert.deepEqual(editableFields('trades',{platform:'cTrader'}),['comment']);
  assert.deepEqual(changesFor('trades',{...original,platform:'cTrader'},{...original,pnl:500,comment:'Поддержка'}),{comment:'Поддержка'});
  assert.throws(()=>changesFor('wallet_transactions',{amount:4},{amount:-5}));
});
