const VERSION='DAYRIS_AUTO_V1',PREFIX=VERSION+'\n',WRAP='DAYRIS_WRAP_V1',encoder=new TextEncoder();
export const encodeBytes=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export function decodeBytes(value){if(typeof value!=='string'||!/^[\w-]+$/.test(value)||value.length>12000)throw new Error('INVALID_ENVELOPE');return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
const api=()=>{if(!globalThis.crypto?.subtle)throw new Error('CRYPTO_UNAVAILABLE');return globalThis.crypto;};
const pair=({owner,peer})=>[owner,peer].sort().join(':');
export const isAutomaticMessage=body=>typeof body==='string'&&body.startsWith(PREFIX);
export function automaticEpoch(body){if(!isAutomaticMessage(body)||body.length>12000)return null;const value=body.split('\n');return value.length===3&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value[1])&&/^[\w-]{39,11000}$/.test(value[2])?value[1]:null;}
export async function createDeviceIdentity(owner){const keyPair=await api().subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);return {owner,id:api().randomUUID(),privateKey:keyPair.privateKey,publicKey:encodeBytes(await api().subtle.exportKey('raw',keyPair.publicKey)),draftKey:await api().subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])};}
export const createConversationKey=()=>api().subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
async function wrappingKey(identity,publicKey,context){
 const publicBytes=decodeBytes(publicKey);if(publicBytes.length!==65)throw new Error('INVALID_PUBLIC_KEY');
 const remote=await api().subtle.importKey('raw',publicBytes,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const bits=new Uint8Array(await api().subtle.deriveBits({name:'ECDH',public:remote},identity.privateKey,256));
 const material=await api().subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);bits.fill(0);
 return api().subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:await api().subtle.digest('SHA-256',encoder.encode(WRAP+':'+context.epoch)),info:encoder.encode([WRAP,pair(context),context.epoch,context.senderDevice,context.recipientDevice].join(':'))},material,{name:'AES-KW',length:256},false,['wrapKey','unwrapKey']);
}
export async function wrapConversationKey(key,identity,recipient,context){const wrapping=await wrappingKey(identity,recipient.public_key,{...context,senderDevice:identity.id,recipientDevice:recipient.id});return encodeBytes(await api().subtle.wrapKey('raw',key,wrapping,'AES-KW'));}
export async function unwrapConversationKey(packet,identity,context){const wrapping=await wrappingKey(identity,packet.public_key,{...context,epoch:packet.epoch_id,senderDevice:packet.sender_device,recipientDevice:identity.id});return api().subtle.unwrapKey('raw',decodeBytes(packet.wrapped_key),wrapping,'AES-KW',{name:'AES-GCM',length:256},true,['encrypt','decrypt']);}
function messageContext(context){if(!context.owner||!context.peer||!context.sender||!context.id||!context.epoch)throw new Error('MISSING_CONTEXT');return encoder.encode([VERSION,pair(context),context.epoch,context.sender,context.id].join(':'));}
export async function encryptAutomaticMessage(body,key,context){
 if(typeof body!=='string'||!body||body.length>2600)throw new Error('MESSAGE_TOO_LONG');
 const iv=api().getRandomValues(new Uint8Array(12)),ciphertext=new Uint8Array(await api().subtle.encrypt({name:'AES-GCM',iv,additionalData:messageContext(context),tagLength:128},key,encoder.encode(body))),bytes=new Uint8Array(12+ciphertext.length);bytes.set(iv);bytes.set(ciphertext,12);
 const result=PREFIX+context.epoch+'\n'+encodeBytes(bytes);if(result.length>12000)throw new Error('MESSAGE_TOO_LONG');return result;
}
export async function decryptAutomaticMessage(body,key,context){const epoch=automaticEpoch(body);if(!epoch||epoch!==context.epoch)throw new Error('INVALID_ENVELOPE');const bytes=decodeBytes(body.split('\n')[2]);return new TextDecoder('utf-8',{fatal:true}).decode(await api().subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:messageContext(context),tagLength:128},key,bytes.slice(12)));}
export async function encryptDeviceDraft(body,identity,context){const iv=api().getRandomValues(new Uint8Array(12)),ciphertext=await api().subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('DAYRIS_DRAFT_V1:'+pair(context))},identity.draftKey,encoder.encode(body));return {iv:encodeBytes(iv),body:encodeBytes(ciphertext)};}
export async function decryptDeviceDraft(draft,identity,context){return new TextDecoder().decode(await api().subtle.decrypt({name:'AES-GCM',iv:decodeBytes(draft.iv),additionalData:encoder.encode('DAYRIS_DRAFT_V1:'+pair(context))},identity.draftKey,decodeBytes(draft.body)));}
