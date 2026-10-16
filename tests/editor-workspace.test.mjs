import test from 'node:test';
import assert from 'node:assert/strict';
import { editorHistory } from '../src/features/admin/useEditorHistory.js';
import { matchSource } from '../src/features/admin/componentSource.js';
import { mergeDesign,validLocalCSS } from '../src/features/appearance/designModel.js';
import { EMPTY_CONFIG } from '../src/features/admin/siteConfig.js';
test('history supports functional changes, undo, redo, branch reset and bounded retention',()=>{
  let state={value:'a',past:[],future:[]};
  state=editorHistory(state,{type:'set',value:previous=>previous+'b'});state=editorHistory(state,{type:'undo'});assert.equal(state.value,'a');
  state=editorHistory(state,{type:'redo'});assert.equal(state.value,'ab');state=editorHistory(state,{type:'undo'});state=editorHistory(state,{type:'set',value:'c'});assert.equal(state.future.length,0);
  for(let i=0;i<100;i++)state=editorHistory(state,{type:'set',value:i});assert.equal(state.past.length,50);
  state=editorHistory(state,{type:'reset',value:'new-file'});assert.deepEqual(state,{value:'new-file',past:[],future:[]});
});
test('debug source must match a catalog path; never arbitrary disk paths',()=>{
  assert.deepEqual(matchSource([{file:'D:\\ai-trade-journal\\Header.jsx',line:42}],['Header.jsx']),{path:'Header.jsx',line:42});
  assert.equal(matchSource([{file:'C:/secrets/file.key'}],['Header.jsx']),null);
  assert.equal(matchSource([{file:'D:/ai-trade-journal/../Header.jsx'}],['Header.jsx']),null);
});
test('design merge keeps bounded source defaults and cloud fields without accepting code',()=>{
  const base=structuredClone(EMPTY_CONFIG),cloud=structuredClone(EMPTY_CONFIG);base.mobile.global.background='#112233';cloud.mobile.elements.settings={width:9000,js:'bad'};
  const result=mergeDesign(base,cloud);assert.equal(result.mobile.global.background,'#112233');assert.equal(result.mobile.elements.settings.width,1200);assert.equal(result.mobile.elements.settings.js,undefined);
  assert.equal(validLocalCSS('body{color:red}'),'body{color:red}');assert.throws(()=>validLocalCSS('x'.repeat(262145)));assert.throws(()=>validLocalCSS('a\0b'));
});
