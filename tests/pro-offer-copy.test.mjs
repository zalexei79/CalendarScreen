import assert from 'node:assert/strict';
import test from 'node:test';
import { getProOfferCopy, XAUUSD_SIGNALS_URL, XAUUSD_SIGNALS_BOT_URL } from '../src/features/pro/proOfferCopy.js';

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
test('PRO booklet explains both platforms and desktop requirements in every locale', () => {
 for (const language of ['ru', 'en', 'md']) {
   const copy = getProOfferCopy(language);
   assert.match(copy.traderBody, /cTrader/);
   assert.match(copy.traderBody, /MetaTrader 5/);
   assert.match(copy.mt5Guide, /Chrome\/Edge/);
   assert.ok(copy.ctraderGuide && copy.openPlatforms);
 }
});
test('signal information points to the supplied channel without promising MT5 bot support', () => {
 assert.equal(XAUUSD_SIGNALS_URL, 'https://t.me/xauusd_scalp_signal');
 assert.equal(XAUUSD_SIGNALS_BOT_URL, 'https://t.me/XauusdScalpSignal_bot');
 for (const language of ['ru', 'en', 'md']) {
   const copy = getProOfferCopy(language);
   assert.match(copy.signalsTitle, /XAUUSD/);
   assert.match(copy.signalsBot, /cTrader/);
   assert.match(copy.signalsBot, /Skalp_XAUUSD/);
   assert.match(copy.signalsBot, /VPS/);
   assert.doesNotMatch(copy.signalsBot, /MT5|MetaTrader/);
   assert.match(copy.signalsNote, /DAYRIS/);
   assert.ok(copy.signalsBody && copy.signalsAction && copy.signalsReceive);
 }
});
