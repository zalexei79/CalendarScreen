import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomViewport,homeViewport} from '../src/features/admin/studioViewport.js';
test('zoom preserves the world point under the cursor, including negative coordinates',()=>{
 const v={x:800,y:-500,scale:.7},point={x:250,y:350};
 const n=zoomViewport(v,point,1.5);
 assert.ok(Math.abs((point.x-v.x)/v.scale-(point.x-n.x)/n.scale)<1e-8);
 assert.ok(Math.abs((point.y-v.y)/v.scale-(point.y-n.y)/n.scale)<1e-8);
 assert.equal(zoomViewport(v,point,100).scale,2);
 assert.equal(zoomViewport(v,point,.001).scale,.25);
});
test('home focuses a calendar anywhere without changing its position',()=>{
 const calendar={x:-18000,y:28000},n=homeViewport(calendar);
 assert.equal(calendar.x*n.scale+n.x,24);assert.equal(calendar.y*n.scale+n.y,24);
 assert.deepEqual(calendar,{x:-18000,y:28000});
});
