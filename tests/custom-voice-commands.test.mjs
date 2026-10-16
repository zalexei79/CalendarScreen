import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVoiceCommands, matchVoiceCommand, setRuntimeVoiceCommands, getRuntimeVoiceCommands, VOICE_ACTIONS } from '../src/shared/lib/customVoiceCommands.js';
import { normalizeConfig } from '../src/features/admin/siteConfig.js';

test('custom phrases only map to bounded existing non-writing actions',()=>{
  const input=[{id:'voice-one',phrase:'Мои деньги',action:'wallet'},{id:'voice-two',phrase:'мои деньги!',action:'pro'},{id:'voice-three',phrase:'Сохрани',action:'wallet'},{id:'voice-evil',phrase:'Мои секреты',action:'javascript:alert(1)'},{id:'voice-four',phrase:'Открыть PRO',action:'pro',enabled:false}];
  const rules=normalizeVoiceCommands(input);
  assert.equal(rules.length,2);assert.deepEqual(matchVoiceCommand('МОИ ДЕНЬГИ!',rules),{type:'wallet'});
  assert.equal(matchVoiceCommand('Открыть PRO',rules),null);assert.equal(matchVoiceCommand('Мои деньги на кофе',rules),null);
  assert.equal(normalizeVoiceCommands(Array.from({length:40},(_,i)=>({id:`voice-${i}`,phrase:`Моя фраза ${i}`,action:'help'}))).length,30);
  assert.equal(VOICE_ACTIONS.some(action=>['entry','voice-confirm','voice-edit','voice-repeat','delete'].includes(action.command.type)),false);
  assert.equal(normalizeVoiceCommands([{id:'voice-help',phrase:'Что ты умеешь',action:'wallet'}]).length,0);
  assert.equal(normalizeVoiceCommands([{id:'voice-bool',phrase:'Мои финансы',action:'wallet',enabled:'false'}]).length,0);
});
test('commands survive the existing normalized draft/publish configuration contract',()=>{
  const config=normalizeConfig({voiceCommands:[{id:'voice-next',phrase:'Листай дальше',action:'next-month'}]});
  assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(config))),config);
  assert.deepEqual(matchVoiceCommand('Листай дальше',config.voiceCommands),{type:'month',direction:1});
  setRuntimeVoiceCommands(config.voiceCommands);assert.equal(getRuntimeVoiceCommands().length,1);setRuntimeVoiceCommands([]);assert.equal(getRuntimeVoiceCommands().length,0);
});
