import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedBirthday,birthdayBounds,birthdayDayCount} from '../src/features/onboarding/birthdayModel.js';
test('birthday cutoff requires thirteen completed years and valid calendar dates',()=>{
 const today=new Date(2026,10,1);
 assert.equal(birthdayBounds(today).maxDate,'2013-11-01');
 for(const date of ['1998-03-14','2000-02-29','2013-11-01'])assert.equal(allowedBirthday(date,today),true,date);
 for(const date of ['2013-11-02','2013-12-01','2023-01-01','2026-01-01','2001-02-29','2000-02-30','','bad'])assert.equal(allowedBirthday(date,today),false,date);
 assert.equal(birthdayDayCount('2013','11',today),1);assert.equal(birthdayDayCount('2000','02',today),29);assert.equal(birthdayDayCount('2001','02',today),28);
 const leapToday=new Date(2028,1,29);assert.equal(birthdayBounds(leapToday).maxDate,'2015-02-28');assert.equal(allowedBirthday('2015-03-01',leapToday),false);
});
