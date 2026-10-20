import test from 'node:test';
import assert from 'node:assert/strict';
import {proExpiry,remainingPro,combinedPro} from '../src/features/admin/adminProModel.js';
test('PRO status respects start time, expiry and infinity',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z');
 const grants=[{starts_at:'2026-10-19',ends_at:'2026-10-21T12:00:00Z'},{starts_at:'2027-01-01',ends_at:'2099-01-01'}];
 assert.equal(proExpiry(grants,now),now+86400000);assert.match(remainingPro(proExpiry(grants,now),now),/Осталось дней: 1/);
 assert.equal(remainingPro(null,now),'PRO не активен');assert.equal(proExpiry([{starts_at:'-infinity',ends_at:'infinity'}],now),Infinity);
 assert.equal(remainingPro(Infinity,now),'Без ограничения срока');
});
test('paid subscription without dates remains active, expired and other providers do not',()=>{
 const subscriptions=[{provider:'lemon_squeezy',status:'active'}];
 assert.deepEqual(combinedPro([],subscriptions),{active:true,expiry:0});
 assert.equal(combinedPro([],[{...subscriptions[0],status:'expired'}]).active,false);
 assert.equal(combinedPro([],[{provider:'other',status:'active'}]).active,false);
});
