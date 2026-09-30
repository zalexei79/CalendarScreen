import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { proNotificationPayload } from '../supabase/functions/send-reminders/proNotification.mjs';

const now = Date.parse('2026-10-01T12:00:00Z');
const job = { notification_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', delivery_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' };
test('PRO push calculates actual remaining days including partial days and leap years', () => {
  for (const days of [271, 3653]) {
    const payload = proNotificationPayload({ ...job, ends_at: new Date(now + (days - 0.25) * 86400000).toISOString() }, now);
    assert.ok(payload.body.includes(`Осталось дней: ${days}.`));
    assert.equal(payload.type, 'pro_granted');
    assert.equal(payload.proNotificationId, job.notification_id);
  }
  assert.equal(proNotificationPayload({ ...job, ends_at: '2036-10-01T12:00:00Z' }, now).body.includes('3653'), true);
});
test('expired or invalid PRO is never announced as active', () => {
  for (const ends_at of ['invalid', new Date(now).toISOString(), new Date(now - 1).toISOString()]) {
    assert.equal(proNotificationPayload({ ...job, ends_at }, now), null);
  }
});
test('PRO push has no financial-plan actions and opens the app without reminder parameters', async () => {
  const handlers = {};
  let shown;
  let opened;
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://dayris.example' },
      addEventListener(name, handler) { handlers[name] = handler; },
      registration: { showNotification(title, options) { shown = { title, ...options }; return Promise.resolve(); } },
      clients: { matchAll: async () => [], openWindow: async url => { opened = url; } },
    },
  });
  let pending;
  const payload = proNotificationPayload({ ...job, ends_at: '2036-10-01T12:00:00Z' }, now);
  handlers.push({ data: { json: () => payload }, waitUntil(promise) { pending = promise; } });
  await pending;
  assert.equal(shown.actions.length, 0);
  assert.equal(shown.data.proNotificationId, job.notification_id);
  assert.equal(shown.tag, `dayris-${job.delivery_id}`);
  handlers.notificationclick({ notification: { ...shown, close() {} }, action: '', waitUntil(promise) { pending = promise; } });
  await pending;
  assert.equal(opened, 'https://dayris.example/');
});
