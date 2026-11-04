import assert from 'node:assert/strict';
import {categorySyncRows,categorySyncSnapshot} from '../src/shared/lib/categorySyncModel.js';
const imported=categorySyncRows(['Diaries',' DIARIES ','Кафе'],['Кафе']);
assert.equal(imported.length,2);assert.equal(imported.find(row=>row.key==='кафе').deleted,true);
const merged=categorySyncSnapshot([{category_key:'diaries',name:'Diaries',deleted:false},{category_key:'кафе',name:'Кафе',deleted:true}],[{key:'diaries',name:'Diaries',deleted:true},{key:'новое',name:'Новое',deleted:false}]);
assert.deepEqual(merged.items,['Новое']);assert.deepEqual(merged.hidden,['Diaries','Кафе']);
assert.deepEqual(categorySyncRows([null,4,'','x'.repeat(61)]),[]);
console.log('PASS: normalized import, deletion tombstones, pending offline edits and invalid names.');
