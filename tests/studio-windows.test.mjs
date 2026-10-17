import test from 'node:test';
import assert from 'node:assert/strict';
import {openStudioWindow,restoreStudioLayout,windowKey} from '../src/features/admin/studioWindows.js';
test('pinned windows retain identity, unpinned editor is replaced',()=>{
 let panes=openStudioWindow([],{id:'voice',label:'Микрофон'});panes[0].pinned=true;
 panes=openStudioWindow(panes,{id:'pro',view:'logic'});assert.equal(panes.length,2);
 panes=openStudioWindow(panes,{id:'settings'});assert.deepEqual(panes.map(p=>p.id),['voice','settings']);
 panes=openStudioWindow(panes,{id:'voice',view:'sources'});assert.equal(panes.length,2);assert.equal(panes[0].view,'sources');assert.equal(panes[0].pinned,true);
});
test('DOM selections have independent identities and pin limit never drops pinned windows',()=>{
 assert.notEqual(windowKey('global',{registered:false,selector:'#a'}),windowKey('global',{registered:false,selector:'#b'}));
 let panes=[];for(let i=0;i<8;i++){panes=openStudioWindow(panes,{id:'button-'+i});panes.at(-1).pinned=true;}
 assert.equal(openStudioWindow(panes,{id:'new'}),panes);
});
test('layout storage is bounded and stores no source or account data',()=>{
 assert.deepEqual(restoreStudioLayout('bad'),{calendar:{x:24,y:54},positions:[]});
 assert.deepEqual(restoreStudioLayout(JSON.stringify({calendar:{x:-4,y:999999},positions:[{key:'voice',x:23,y:45,code:'secret'},{key:'bad',x:'no',y:0}]})),{calendar:{x:-4,y:999999},positions:[{key:'voice',x:23,y:45}]});
});
