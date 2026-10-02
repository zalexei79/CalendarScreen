import assert from 'node:assert/strict';
import test from 'node:test';
import { TRANSLATIONS, translate, monthsFor } from '../src/shared/i18n/index.js';

test('all supported locales expose the same interface keys', () => {
  const russianKeys = Object.keys(TRANSLATIONS.ru).sort();

  for (const language of ['en', 'md', 'zh-CN']) {
    assert.deepEqual(
      Object.keys(TRANSLATIONS[language]).sort(),
      russianKeys,
      `${language} is missing one or more interface translations`,
    );
  }
});

test('Romanian resolves through the Moldova locale bundle', () => {
  assert.equal(translate('ro', 'planCompleteEyebrow'), TRANSLATIONS.md.planCompleteEyebrow);
});

test('Chinese resolves browser locale variants and preserves interpolation tokens', () => {
  assert.equal(translate('zh-Hans-CN', 'settings'), '设置');
  assert.equal(translate('zh-CN', 'titleMoney'), '财务日历');
  assert.deepEqual(monthsFor('zh-CN'), Array.from({ length: 12 }, (_, i) => `${i + 1}月`));
  for (const [key, english] of Object.entries(TRANSLATIONS.en)) {
    assert.deepEqual(
      TRANSLATIONS['zh-CN'][key].match(/\{\d+\}/g) || [],
      english.match(/\{\d+\}/g) || [],
      `${key} must preserve interpolation placeholders`,
    );
  }
});
