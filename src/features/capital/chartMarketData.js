const url='https://data-api.binance.vision/api/v3/klines',cache=new Map();
const intervals=new Set(['1m','5m','15m','1h','4h','1d','1w','1M']);
export async function fetchCryptoCandles(symbol,interval,{signal}={}){
 if(!/^[A-Z0-9]{5,20}$/.test(symbol)||!intervals.has(interval))throw new Error('Invalid candle request');
 const key=symbol+':'+interval,saved=cache.get(key);
 if(saved&&Date.now()-saved.at<30000)return saved.rows;
 const response=await fetch(`${url}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=500`,{signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('Crypto candle source unavailable');const data=await response.json();
 if(!Array.isArray(data))throw new Error('Invalid candle response');
 const rows=data.map(row=>({date:new Date(Number(row[0])).toISOString().slice(0,10),time:Number(row[0])/1000,open:String(row[1]),high:String(row[2]),low:String(row[3]),close:String(row[4]),price:String(row[4]),volume:String(row[5])}));
 cache.set(key,{at:Date.now(),rows});if(cache.size>32)cache.delete(cache.keys().next().value);return rows;
}
export function openCryptoCandleStream(symbol,interval,onBar,onState){
 let socket,timer,closed=false,attempt=0;
 const connect=()=>{if(closed||!navigator.onLine)return;if(socket?.readyState===1||socket?.readyState===0)return;const current=new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`);socket=current;onState('connecting');
 socket.onopen=()=>{if(closed||current!==socket)return;attempt=0;onState('live');};
 socket.onmessage=event=>{if(closed||current!==socket)return;try{const k=JSON.parse(event.data)?.k;if(!k||k.s!==symbol||k.i!==interval)return;onBar({date:new Date(k.t).toISOString().slice(0,10),time:k.t/1000,open:k.o,high:k.h,low:k.l,close:k.c,price:k.c,volume:k.v});}catch{}};
 socket.onerror=()=>current.close();socket.onclose=()=>{if(closed||current!==socket)return;onState(navigator.onLine?'reconnecting':'offline');timer=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));};};
 const offline=()=>{clearTimeout(timer);const old=socket;socket=null;old?.close();onState('offline');};const online=()=>{clearTimeout(timer);connect();};
 window.addEventListener('offline',offline);window.addEventListener('online',online);connect();
 return()=>{closed=true;clearTimeout(timer);socket?.close();window.removeEventListener('offline',offline);window.removeEventListener('online',online);};
}
