import assert from 'node:assert/strict';
import test from 'node:test';
import { getProOfferCopy } from '../src/features/pro/proOfferCopy.js';

test('PRO presentation has complete, non-empty copy in every supported language', () => {
  const keys = Object.keys(getProOfferCopy('ru')).sort();
  for (const language of ['ru', 'en', 'md']) {
    const copy = getProOfferCopy(language);
    assert.deepEqual(Object.keys(copy).sort(), keys);
    for (const [key, value] of Object.entries(copy)) {
      const values = Array.isArray(value) ? value : [value];
      assert.ok(values.length > 0, `${language}.${key}`);
      for (const text of values) assert.ok(typeof text === 'string' && text.trim(), `${language}.${key}`);
    }
    for (const feature of ['wallet', 'money', 'trader']) {
      assert.equal(copy[`${feature}Points`].length, 3);
    }
    assert.equal(copy.categories.length, 3);
  }
});

test('PRO presentation resolves regional locales and safe fallbacks', () => {
  assert.equal(getProOfferCopy('ro-RO'), getProOfferCopy('md'));
  assert.equal(getProOfferCopy('EN-us'), getProOfferCopy('en'));
  assert.equal(getProOfferCopy('ru-RU'), getProOfferCopy('ru'));
  assert.equal(getProOfferCopy(undefined), getProOfferCopy('ru'));
  assert.equal(getProOfferCopy('unknown'), getProOfferCopy('ru'));
});
