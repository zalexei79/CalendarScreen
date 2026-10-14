import test from 'node:test';import assert from 'node:assert/strict';
import {readWorkspace,writeWorkspace,clearWorkspace,workspaceKey} from '../src/shared/lib/sessionWorkspace.js';
const a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
test('drafts restore exact text, isolate owners, expire, clear and tolerate blocked storage',()=>{
 const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 writeWorkspace(a,'purchase',{quantity:'0.00000001',price:'123.45'});assert.deepEqual(readWorkspace(a,'purchase'),{quantity:'0.00000001',price:'123.45'});assert.equal(readWorkspace(b,'purchase'),null);assert.equal(readWorkspace(null,'purchase'),null);
 values.set(workspaceKey(a,'old'),JSON.stringify({at:Date.now()-86400001,value:{amount:'10'}}));assert.equal(readWorkspace(a,'old'),null);
 values.set(workspaceKey(a,'bad'),'not json');assert.equal(readWorkspace(a,'bad'),null);values.set(workspaceKey(a,'bad'),JSON.stringify({value:{}}));assert.equal(readWorkspace(a,'bad'),null);
 clearWorkspace(a,'purchase');assert.equal(readWorkspace(a,'purchase'),null);
 globalThis.sessionStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};assert.equal(readWorkspace(a,'purchase'),null);assert.doesNotThrow(()=>writeWorkspace(a,'purchase',{}));assert.doesNotThrow(()=>clearWorkspace(a,'purchase'));delete globalThis.sessionStorage;
});
