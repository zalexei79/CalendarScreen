import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPlaybackVoice,voicesForLocale} from '../src/shared/lib/voicePlayback.js';
test('choose matching enhanced voice, preserve preference, never select foreign accent',()=>{
 const voices=[{name:'English Natural',voiceURI:'en',lang:'en-US',default:true},{name:'Basic',voiceURI:'basic',lang:'ru-RU',localService:true},{name:'Russian Enhanced',voiceURI:'enhanced',lang:'ru-RU',localService:true},{name:'Cloud Natural',voiceURI:'cloud',lang:'ru-RU',localService:false}];
 assert.equal(selectPlaybackVoice(voices,'ru').voiceURI,'enhanced');
 assert.equal(selectPlaybackVoice(voices,'ru','basic').voiceURI,'basic');
 assert.equal(selectPlaybackVoice(voices,'ru','cloud',false).voiceURI,'enhanced');
 assert.equal(selectPlaybackVoice(voices,'ro'),null);
 assert.equal(voicesForLocale(voices,'ru').length,3);
});
