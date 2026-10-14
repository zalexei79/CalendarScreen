import test from 'node:test';
import assert from 'node:assert/strict';
import {weekdaysFor} from '../src/shared/i18n/weekdays.js';

test('weekday labels follow language switches and preserve Monday-first order', () => {
  for (const [locale, expected] of [
    ['md', ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']],
    ['en', ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']],
    ['ru', ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']],
    ['zh-CN', ['周一','周二','周三','周四','周五','周六','周日']],
    ['ro-RO', ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']],
    ['en-US', ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']],
  ]) assert.deepEqual(weekdaysFor(locale), expected);
});
