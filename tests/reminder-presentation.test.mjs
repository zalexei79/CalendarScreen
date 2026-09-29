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

test('push uses brand, event and amount on separate lines for existing payloads', async () => {
  for (const [title, body] of [
    ['Пополнение мобильного · $555', 'Пополнение мобильного\n$555'],
    ['Phone top-up · €20', 'Phone top-up\n€20'],
    ['Telefon · 100 L', 'Telefon\n100 L'],
    ['Аренда · ₽1 200,50', 'Аренда\n₽1 200,50'],
    ['Название · без суммы', 'Название · без суммы'],
  ]) {
    const result = await notification({ title, body: 'Сегодня · 09:00 — оплатить и отметить.' });
    assert.equal(result.title, 'DAYRIS');
    assert.equal(result.body, body);
  }
});

test('push preserves reminder routing, deduplication and actions', async () => {
  const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const result = await notification({ title: 'План', reminderId: id, deliveryId: id });
  assert.equal(result.data.reminderId, id);
  assert.equal(result.tag, `dayris-${id}`);
  assert.equal(result.actions.map(item => item.action).join(','), 'completed,missed,amount');
  const fallback = await notification({ title: {}, reminderId: 'invalid' });
  assert.equal(fallback.title, 'DAYRIS');
  assert.equal(fallback.data.reminderId, '');
});
