// Versioned envelopes travel through the existing friend-only RPC and its 2,000-character limit.
const NOTE='DAYRIS_NOTE_V1\n';
const LOCK='DAYRIS_LOCK_V1\n';
export const FRIEND_BODY_LIMIT=2000;
export function readFriendNote(body){
 if(typeof body!=='string'||!body.startsWith(NOTE)||body.length>FRIEND_BODY_LIMIT)return null;
 try{const value=JSON.parse(body.slice(NOTE.length)),r=value.reply;if(typeof value.text!=='string'||!value.text.trim()||!r||typeof r.text!=='string'||r.text.length>160||typeof r.sender!=='string'||r.sender.length>80||typeof r.id!=='string'||r.id.length>80)return null;return {text:value.text,reply:{id:r.id,sender:r.sender,text:r.text}};}catch{return null;}
}
export function friendNote(text,reply){return reply?NOTE+JSON.stringify({text,reply:{id:reply.id,sender:reply.sender,text:reply.text.slice(0,160)}}):text;}
export const isLockedMessage=body=>typeof body==='string'&&body.startsWith(LOCK);
export function friendMessagePreview(body,copy){if(isLockedMessage(body))return copy.lockedMessage;if(body?.startsWith('DAYRIS_DAY_V1\n'))return copy.day;if(body?.startsWith('DAYRIS_STREAK_V1\n'))return copy.streak;return readFriendNote(body)?.text||body||'';}
function b64(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function unb64(text){if(!/^[\w-]+$/.test(text))throw new Error('INVALID_KEY');return Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));}
function cryptoApi(){if(!globalThis.crypto?.subtle)throw new Error('CRYPTO_UNAVAILABLE');return globalThis.crypto;}
export function createFriendKey(){return 'DR1-'+b64(cryptoApi().getRandomValues(new Uint8Array(32)));}
export async function importFriendKey(code){
 const raw=unb64(code.trim().replace(/^DR1-/,''));if(raw.length!==32)throw new Error('INVALID_KEY');
 const api=cryptoApi(),key=await api.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
 const digest=new Uint8Array(await api.subtle.digest('SHA-256',raw));
 const fingerprint=Array.from(digest.slice(0,6),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{4}/g).join(' ');
 raw.fill(0);return {key,fingerprint};
}
function context({owner,peer,sender,id}){if(!owner||!peer||!sender||!id)throw new Error('MISSING_CONTEXT');return new TextEncoder().encode(LOCK.trim()+':'+[owner,peer].sort().join(':')+':'+sender+':'+id);}
export function friendWireSize(body,encrypted=false){return encrypted?LOCK.length+Math.ceil((new TextEncoder().encode(body).length+28)*4/3):body.length;}
export async function lockFriendMessage(body,key,identity){
 if(friendWireSize(body,true)>FRIEND_BODY_LIMIT)throw new Error('MESSAGE_TOO_LONG');
 const api=cryptoApi(),iv=api.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await api.subtle.encrypt({name:'AES-GCM',iv,additionalData:context(identity),tagLength:128},key,new TextEncoder().encode(body)));
 const packed=new Uint8Array(iv.length+encrypted.length);packed.set(iv);packed.set(encrypted,iv.length);return LOCK+b64(packed);
}
export async function unlockFriendMessage(body,key,identity){
 if(!isLockedMessage(body)||body.length>FRIEND_BODY_LIMIT)throw new Error('INVALID_MESSAGE');
 const packed=unb64(body.slice(LOCK.length));if(packed.length<29)throw new Error('INVALID_MESSAGE');
 const plaintext=await cryptoApi().subtle.decrypt({name:'AES-GCM',iv:packed.slice(0,12),additionalData:context(identity),tagLength:128},key,packed.slice(12));
 return new TextDecoder('utf-8',{fatal:true}).decode(plaintext);
}
