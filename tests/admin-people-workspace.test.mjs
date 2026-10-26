import test from 'node:test';
import assert from 'node:assert/strict';
import {entryLocation} from '../src/features/admin/adminPeopleWorkspaceModel.js';
test('entry navigation stays bound to owner, dataset and a valid calendar day',()=>{
 const row={user_id:'owner',dataset:'trades',record_date:'2024-02-29T15:00:00',record_key:'42'};
 assert.deepEqual(entryLocation(row,'owner'),{month:'2024-02',day:'2024-02-29',dataset:'trades',key:'42'});
 assert.equal(entryLocation(row,'other'),null);
 for(const record_date of ['2023-02-29','2024-02-30','1899-01-01','2201-01-01','not-a-date','2024-13-01'])assert.equal(entryLocation({...row,record_date},'owner'),null);
 assert.equal(entryLocation({...row,dataset:'auth.users'},'owner'),null);
 assert.equal(entryLocation(null,'owner'),null);
});
