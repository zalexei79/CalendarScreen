import {createDeviceIdentity} from './automaticChatCrypto.js';
let database;const identities=new Map();
function open(){if(!database)database=new Promise((resolve,reject)=>{if(!globalThis.indexedDB){reject(new Error('CRYPTO_STORAGE_UNAVAILABLE'));return;}const request=indexedDB.open('dayris-friend-keys',1);request.onupgradeneeded=()=>request.result.createObjectStore('vault');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('CRYPTO_STORAGE_UNAVAILABLE'));}).catch(error=>{database=null;throw error;});return database;}
async function transaction(mode,action){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('vault',mode);let value;const request=action(tx.objectStore('vault'));if(request)request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export const friendCryptoStore={
 get:key=>transaction('readonly',store=>store.get(key)),
 put:(key,value)=>transaction('readwrite',store=>store.put(value,key)),
 delete:key=>transaction('readwrite',store=>store.delete(key)),
 async identity(owner){
  if(!identities.has(owner))identities.set(owner,(async()=>{let value=await this.get('device:'+owner);if(value)return value;const fresh=await createDeviceIdentity(owner),db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault'),request=store.get('device:'+owner);request.onsuccess=()=>{value=request.result||fresh;if(!request.result)store.put(fresh,'device:'+owner);};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);});})().catch(error=>{identities.delete(owner);throw error;}));
  return identities.get(owner);
 }
};
