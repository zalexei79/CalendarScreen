import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetaTrader, parseMetaTraderExport, pendingMetaTrader, rowsForMetaTraderAccount } from './parseMetaTrader.mjs';
const header='platform;server;account;ticket;date;time;symbol;direction;profit;swap;commission;currency';
const csv=(row)=>`${header}\n${row}\nEND\n`;
test('MT5 net profit includes entry/exit costs; direction maps to existing schema',()=>{
  const [row]=parseMetaTrader(csv('MT5;Broker-Demo;42;123;2026-09-29;12:30:00;XAUUSD;buy;100;-2;-5;USD'));
  assert.equal(row.signedPnl,93); assert.equal(row.direction,'LONG'); assert.equal(row.time,'12:30');
  assert.equal(pendingMetaTrader([row],{'2026-09-29':[{comment:row.comment}]}).length,0);
});
test('MT4 sell and multiple servers have separate identities',()=>{
 const a=parseMetaTrader(csv('MT4;A;42;123;2026-09-29;12:30:00;EURUSD;sell;-10;0;-1;EUR'))[0];
 const b=parseMetaTrader(csv('MT4;B;42;123;2026-09-29;12:30:00;EURUSD;sell;-10;0;-1;EUR'))[0];
 assert.equal(a.signedPnl,-11); assert.equal(a.direction,'SHORT'); assert.notEqual(a.comment,b.comment);
});
test('reject torn writes, malformed amounts, deposits, duplicate tickets',()=>{
 const row='MT5;A;42;123;2026-09-29;12:30:00;EURUSD;buy;10;0;0;USD';
 assert.throws(()=>parseMetaTrader(`${header}\n${row}`));
 assert.throws(()=>parseMetaTrader(csv(row.replace(';10;',';NaN;'))));
 assert.throws(()=>parseMetaTrader(csv(row.replace(';buy;',';balance;'))));
 assert.throws(()=>parseMetaTrader(csv(`${row}\n${row}`)));
});
test('empty account export includes real account metadata and balance', () => {
 const data = parseMetaTraderExport(csv('ACCOUNT;MT5;Broker-Demo;42;Broker;Demo;1234.50;USD;2026-09-30 00:30:00'));
 assert.equal(data.rows.length, 0); assert.equal(data.accounts[0].balance, 1234.5);
 assert.equal(data.accounts[0].mode, 'Demo'); assert.equal(data.accounts[0].id, 'MT5:Broker-Demo:42');
});
test('account selection isolates same login across brokers and preserves old exports', () => {
 const data = parseMetaTraderExport(csv('MT5;A;42;123;2026-09-29;12:30:00;EURUSD;buy;10;0;0;USD\nMT5;B;42;124;2026-09-29;12:30:00;EURUSD;buy;20;0;0;USD'));
 assert.equal(data.accounts.length, 2);
 assert.equal(rowsForMetaTraderAccount(data.rows, 'MT5:A:42').length, 1);
 assert.equal(rowsForMetaTraderAccount(data.rows, 'MT5:B:42')[0].signedPnl, 20);
 assert.equal(rowsForMetaTraderAccount(data.rows, 'MT5:A:4').length, 0);
});
test('reject mismatched metadata, invalid balance and trade-only malformed account', () => {
 const meta = 'ACCOUNT;MT5;A;42;Broker;Demo;100;USD;2026-09-30 00:30:00';
 const row = 'MT5;B;42;123;2026-09-29;12:30:00;EURUSD;buy;10;0;0;USD';
 assert.throws(() => parseMetaTraderExport(csv(`${meta}\n${row}`)));
 assert.throws(() => parseMetaTraderExport(csv(meta.replace(';100;', ';NaN;'))));
 assert.throws(() => parseMetaTraderExport(csv(meta.replace(';Demo;', ';Unknown;'))));
});
