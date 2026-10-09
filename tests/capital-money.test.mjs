import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyChange, calculatePositions, calculateReturnPercent, formatMoney, MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE, scaledToString } from '../src/features/capital/decimal.js';

const asset = { id:'asset-1', category:'stock', currency:'USD' };
const operation = (id, op, quantity, price, fee, date='2026-01-01') => ({
  id, asset_id:'asset-1', operation:op, quantity, unit_price:price, fee, currency:'USD', occurred_on:date, created_at:`2026-01-${id.padStart(2,'0')}T00:00:00Z`,
});

test('purchase and partial sale preserve cost basis, commissions and realized PnL exactly', () => {
  const [position] = calculatePositions([asset], [
    operation('01','buy','2','10','1'),
    operation('02','sell','0.5','12','0.5','2026-01-02'),
  ]);
  assert.equal(scaledToString(position.quantity, QUANTITY_SCALE), '1.5');
  assert.equal(scaledToString(position.invested, MONEY_SCALE), '15.75');
  assert.equal(scaledToString(position.averageCost, MONEY_SCALE), '10.5');
  assert.equal(scaledToString(position.realized, MONEY_SCALE), '0.25');
  const current = multiplyScaled(position.quantity, QUANTITY_SCALE, parseScaled('11', MONEY_SCALE), MONEY_SCALE);
  assert.equal(scaledToString(current + position.realized - position.invested, MONEY_SCALE), '1');
});

test('large fractional quantities and prices are multiplied without binary floating point', () => {
  const q = parseScaled('0.123456789012', QUANTITY_SCALE);
  const p = parseScaled('123456.7890123456', MONEY_SCALE);
  assert.equal(scaledToString(multiplyScaled(q, QUANTITY_SCALE, p, MONEY_SCALE), MONEY_SCALE), '15241.5787531962');
});

test('full sale closes quantity and leaves realized profit and loss', () => {
  const [position] = calculatePositions([asset], [
    operation('01','buy','3','7','0.01'),
    operation('02','sell','3','9','0.02','2026-01-02'),
  ]);
  assert.equal(position.quantity, 0n);
  assert.equal(position.invested, 0n);
  assert.equal(scaledToString(position.realized, MONEY_SCALE), '5.97');
});

test('weighted-average cost basis, dividends, and manual revaluation do not double count', () => {
  const [position] = calculatePositions([asset], [
    operation('01','buy','2','10','1'),
    operation('02','buy','2','14','1','2026-01-02'),
    operation('03','sell','1','15','0.5','2026-01-03'),
    operation('04','dividend','3','0.5','0.1','2026-01-04'),
    operation('05','revalue','0','20','0','2026-01-05'),
  ]);
  assert.equal(scaledToString(position.quantity, QUANTITY_SCALE), '3');
  assert.equal(scaledToString(position.invested, MONEY_SCALE), '37.5');
  assert.equal(scaledToString(position.averageCost, MONEY_SCALE), '12.5');
  assert.equal(scaledToString(position.realized, MONEY_SCALE), '3.4');
});

test('rejects a sale that would make the historical position negative', () => {
  assert.throws(() => calculatePositions([asset], [operation('01','sell','1','10','0')]), /Sale exceeds position/);
});

test('rejects precision beyond the database numeric scale', () => {
  assert.throws(() => parseScaled('0.0000000000001', QUANTITY_SCALE), /decimal places/);
  assert.throws(() => parseScaled('1.00000000001', MONEY_SCALE), /decimal places/);
});

test('currency formatting rounds from exact scaled integer values', () => {
  assert.equal(formatMoney(parseScaled('1234.5678912345', MONEY_SCALE), 'USD', 'en-US'), '$1,234.57');
  assert.match(formatMoney(parseScaled('-1234.565', MONEY_SCALE, { allowNegative: true }), 'EUR', 'de-DE'), /1\.234,57/);
});

test('calculates return percentages from exact money units', () => {
  assert.equal(calculateReturnPercent(parseScaled('1',MONEY_SCALE),parseScaled('3',MONEY_SCALE)), 3333n);
  assert.equal(calculateReturnPercent(parseScaled('-1',MONEY_SCALE,{allowNegative:true}),parseScaled('4',MONEY_SCALE)), -2500n);
  assert.equal(calculateReturnPercent(0n,0n), null);
});

test('calculates day change only from a saved prior-day value in the same currency', () => {
  const changes = calculateDailyChange({USD:{value:parseScaled('110',MONEY_SCALE)},EUR:{value:parseScaled('80',MONEY_SCALE)}},[
    {currency:'USD',portfolio_value:'100',sampled_on:'2026-10-08'},
    {currency:'USD',portfolio_value:'105',sampled_on:'2026-10-09'},
    {currency:'EUR',portfolio_value:'90',sampled_on:'2026-10-07'},
  ],'2026-10-09');
  assert.equal(scaledToString(changes.USD.value,MONEY_SCALE),'10');
  assert.equal(scaledToString(changes.USD.baseline,MONEY_SCALE),'100');
  assert.equal(changes.EUR,undefined);
});


test('supports USDT as a separate unit and formats zero-decimal currencies', () => {
  assert.match(formatMoney(parseScaled('1234.5', MONEY_SCALE), 'USDT', 'en-US'), /USDT/);
  assert.equal(formatMoney(parseScaled('1234', MONEY_SCALE), 'JPY', 'en-US'), '¥1,234');
});

test('parses decimal scientific notation without floating-point conversion', () => {
  assert.equal(scaledToString(parseScaled('1.234e-3', MONEY_SCALE), MONEY_SCALE), '0.001234');
  assert.equal(scaledToString(parseScaled('12e2', MONEY_SCALE), MONEY_SCALE), '1200');
});
