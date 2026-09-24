import assert from 'node:assert/strict';
import test from 'node:test';
import { TRANSLATIONS, translate } from '../src/shared/i18n/index.js';

test('all supported locales expose the same interface keys', () => {
  const russianKeys = Object.keys(TRANSLATIONS.ru).sort();

  for (const language of ['en', 'md']) {
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
