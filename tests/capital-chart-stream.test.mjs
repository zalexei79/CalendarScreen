import assert from 'node:assert/strict';import test from 'node:test';import {openCryptoCandleStream} from '../src/features/capital/chartMarketData.js';
test('stream handles online/offline, reconnects, ignores wrong instruments and closes cleanly',()=>{
 const previous={window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),WebSocket:globalThis.WebSocket};
 const win=new EventTarget(),network={onLine:true},sockets=[],states=[],bars=[];
 class Socket{constructor(){this.readyState=0;sockets.push(this);}close(){this.readyState=3;this.onclose?.();}}
 globalThis.window=win;Object.defineProperty(globalThis,'navigator',{configurable:true,value:network});globalThis.WebSocket=Socket;
 let stop;
 try{
  stop=openCryptoCandleStream('BTCUSDT','1m',bar=>bars.push(bar),state=>states.push(state));const first=sockets[0];first.readyState=1;first.onopen();
  first.onmessage({data:JSON.stringify({k:{s:'ETHUSDT',i:'1m',t:1791936000000,o:'100',h:'110',l:'90',c:'105',v:'10'}})});assert.equal(bars.length,0);
  first.onmessage({data:JSON.stringify({k:{s:'BTCUSDT',i:'1m',t:1791936000000,o:'100',h:'110',l:'90',c:'105',v:'10'}})});assert.equal(bars[0].close,'105');
  network.onLine=false;win.dispatchEvent(new Event('offline'));assert.equal(states.at(-1),'offline');network.onLine=true;win.dispatchEvent(new Event('online'));assert.equal(sockets.length,2);
  first.onopen();assert.notEqual(states.at(-1),'live','late events from the closed connection cannot mark new data LIVE');
  stop();assert.equal(sockets[1].readyState,3);win.dispatchEvent(new Event('online'));assert.equal(sockets.length,2);
 }finally{stop?.();globalThis.window=previous.window;globalThis.WebSocket=previous.WebSocket;if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator;}
});
