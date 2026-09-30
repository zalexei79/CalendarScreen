import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
async function notification(payload) {
  const handlers = {};
  let shown;
  vm.runInNewContext(source, {
    self: {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      registration: { showNotification: (title, options) => { shown = { title, ...options }; return Promise.resolve(); } },
    },
  });
  let pending;
  handlers.push({ data: { json: () => payload }, waitUntil: promise => { pending = promise; } });
  await pending;
  return shown;
}

test('push shows the event and amount instead of repeating the OS app label', async () => {
  for (const title of [
    'Зарплата · $20',
    'Пополнение мобильного · $555',
    'Phone top-up · €20',
    'Telefon · 100 L',
    'Аренда · ₽1 200,50',
    'Название · без суммы',
  ]) {
    const body = 'Сегодня · 09:00 — оплатить и отметить.';
    const result = await notification({ title, body });
    assert.equal(result.title, title);
    assert.equal(result.body, body);
    assert.equal(`${result.title} ${result.body}`.includes('DAYRIS'), false);
  }
});

test('income reminders retain timing and never claim the salary has arrived', async () => {
  const result = await notification({ title: 'Зарплата · $20', body: 'Завтра · 09:00 — получить и отметить.' });
  assert.equal(result.title, 'Зарплата · $20');
  assert.equal(result.body, 'Завтра · 09:00 — получить и отметить.');
  assert.equal(result.body.includes('пришла'), false);
});

test('missing or invalid copy falls back to a useful reminder, not the brand', async () => {
  for (const payload of [{}, { title: {}, body: {} }, { title: 'x'.repeat(90), body: 'x'.repeat(161) }]) {
    const result = await notification(payload);
    assert.equal(result.title, 'Напоминание');
    assert.equal(result.body, 'Откройте календарь и отметьте выполнение.');
  }
  const cleaned = await notification({ title: '  План  ', body: '  Сегодня\n09:00  ' });
  assert.equal(cleaned.title, 'План');
  assert.equal(cleaned.body, 'Сегодня 09:00');
});

test('push preserves reminder routing, deduplication and actions', async () => {
  const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const result = await notification({ title: 'План', reminderId: id, deliveryId: id });
  assert.equal(result.data.reminderId, id);
  assert.equal(result.tag, `dayris-${id}`);
  assert.equal(result.actions.map(item => item.action).join(','), 'completed,missed,amount');
  const fallback = await notification({ title: {}, reminderId: 'invalid' });
  assert.equal(fallback.title, 'Напоминание');
  assert.equal(fallback.data.reminderId, '');
});
