import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleVoiceTranscript} from '../src/shared/lib/voiceTranscript.js';
const result = (transcript, isFinal = true) => Object.assign([{transcript}], {isFinal});

test('Android growing final hypotheses form one phrase, including partial words and lost spaces', () => {
 const phrases = ['я', 'Я сегодня', 'Я сегодня потра', 'Я сегодня потратил', 'Я сегодня потратил', 'Я сегодня потратил50', 'Я сегодня потратил 50 лей', 'Я сегодня потратил 50 лей', 'Я сегодня потратил 50 лей на сок'];
 assert.equal(assembleVoiceTranscript([...phrases, phrases.at(-1)].map(p => result(p))), phrases.at(-1));
});
test('independent final chunks and repeated complete purchases remain intact', () => {
 assert.equal(assembleVoiceTranscript(['Что', 'Что ты умеешь'].map(p => result(p))), 'Что ты умеешь');
 assert.equal(assembleVoiceTranscript(['запиши', 'потратил 80 лей', 'на пиво'].map(p => result(p))), 'запиши потратил 80 лей на пиво');
 assert.equal(assembleVoiceTranscript(['такси 80', 'такси 80'].map(p => result(p))), 'такси 80 такси 80');
 assert.equal(assembleVoiceTranscript(['на', 'напитки 50'].map(p => result(p))), 'на напитки 50');
});
test('interim revisions replace the earlier hypothesis without altering money or corrections', () => {
 assert.equal(assembleVoiceTranscript([result('потратил 12,50 евро'), result('на ко', false), result('на кофе', false)]), 'потратил 12,50 евро на кофе');
 assert.equal(assembleVoiceTranscript([result('потратил 50'), result('нет 350')]), 'потратил 50 нет 350');
});
test('growing hypotheses normalize across supported languages', () => {
 for (const phrases of [['I', 'I spent', 'I spent 30k on a monitor'], ['Eu', 'Eu am', 'Eu am cheltuit 50 lei'], ['我', '我花了', '我花了50元']]) {
  assert.equal(assembleVoiceTranscript(phrases.map(p => result(p))), phrases.at(-1));
 }
 assert.equal(assembleVoiceTranscript([]), '');
});
