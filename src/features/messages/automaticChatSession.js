import {friendCryptoStore} from './friendCryptoStore.js';
import {automaticEpoch,createConversationKey,wrapConversationKey,unwrapConversationKey,encryptAutomaticMessage,decryptAutomaticMessage,encryptDeviceDraft,decryptDeviceDraft} from './automaticChatCrypto.js';
import {setProtectedFriendDraft} from '../social/friendWorkspace.js';
const registrations=new WeakMap(),draftWrites=new Map();
async function rpc(client,name,args){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{let pending=client.rpc(name,args);if(pending.abortSignal)pending=pending.abortSignal(controller.signal);const {data,error}=await pending;if(error)throw error;if(data?.owner_id!==args.p_owner)throw {code:'42501'};return data;}finally{clearTimeout(timer);}}
export async function registerFriendDevice(client,owner,store=friendCryptoStore){
 const identity=await store.identity(owner);let owners=registrations.get(client);if(!owners){owners=new Map();registrations.set(client,owners);}const previous=owners.get(owner);
 if(previous?.id===identity.id&&Date.now()-previous.at<240000)return identity;
 await rpc(client,'friend_chat_register_device',{p_device:identity.id,p_public_key:identity.publicKey,p_owner:owner});owners.set(owner,{id:identity.id,at:Date.now()});return identity;
}
export function createAutomaticChat(client,owner,peer,store=friendCryptoStore){
 const context={owner,peer},keyPrefix=owner+':'+peer+':',keys=new Map();let identity,outgoing,inFlight,state={ready:false,status:'loading',devices:0};
 const api={
  get state(){return state;},
  async sync(epochs=[]){
   if(inFlight)return inFlight;
   inFlight=(async()=>{
    identity=await registerFriendDevice(client,owner,store);
    outgoing=await store.get('outgoing:'+keyPrefix);
    const ids=[...new Set([...epochs.filter(Boolean).slice(-99),outgoing?.epoch].filter(Boolean))];
    let ring=await rpc(client,'friend_chat_keyring',{p_peer:peer,p_device:identity.id,p_owner:owner,p_epochs:null});
    const missingEpochs=ids.filter(id=>id!==outgoing?.epoch&&!ring.epochs?.some(epoch=>epoch.id===id));
    if(missingEpochs.length){const older=await rpc(client,'friend_chat_keyring',{p_peer:peer,p_device:identity.id,p_owner:owner,p_epochs:missingEpochs});ring={...ring,epochs:[...(ring.epochs||[]),...(older.epochs||[])],packets:[...(ring.packets||[]),...(older.packets||[])]};}
    const devices=ring.devices||[],peerDevices=devices.filter(d=>d.owner_id===peer);if(!devices.some(d=>d.id===identity.id&&d.owner_id===owner))throw {code:'42501'};
    for(const packet of ring.packets||[]){if(keys.has(packet.epoch_id))continue;let key=await store.get('key:'+keyPrefix+packet.epoch_id);if(!key){key=await unwrapConversationKey(packet,identity,context);await store.put('key:'+keyPrefix+packet.epoch_id,key);}keys.set(packet.epoch_id,key);}
    if(!outgoing){outgoing={epoch:crypto.randomUUID(),key:await createConversationKey()};await store.put('outgoing:'+keyPrefix,outgoing);await store.put('key:'+keyPrefix+outgoing.epoch,outgoing.key);}
    keys.set(outgoing.epoch,outgoing.key);
    if(!peerDevices.length){state={ready:false,status:'waiting',devices:0};return state;}
    const delivered=new Map((ring.epochs||[]).map(e=>[e.id,new Set(e.delivered||[])]));
    for(const [epoch,key] of keys){if(epoch!==outgoing.epoch&&!delivered.has(epoch))continue;const missing=devices.filter(d=>!delivered.get(epoch)?.has(d.id));if(!missing.length)continue;const packets=await Promise.all(missing.map(async device=>({recipient_device:device.id,wrapped_key:await wrapConversationKey(key,identity,device,{...context,epoch})})));const result=await rpc(client,'friend_chat_publish_keys',{p_peer:peer,p_device:identity.id,p_epoch:epoch,p_packets:packets,p_owner:owner});if(result.epoch_id!==epoch)throw {code:'42501'};}
    state={ready:true,status:'ready',devices:peerDevices.length};return state;
   })().catch(error=>{state={ready:false,status:'error',devices:0,error};throw error;}).finally(()=>{inFlight=null;});return inFlight;
  },
  async encrypt(body,id){await api.sync();if(!state.ready)throw new Error('PEER_NOT_READY');return encryptAutomaticMessage(body,outgoing.key,{...context,epoch:outgoing.epoch,sender:owner,id});},
  async decrypt(message){const epoch=automaticEpoch(message.body);if(!epoch)throw new Error('INVALID_ENVELOPE');let key=keys.get(epoch)||await store.get('key:'+keyPrefix+epoch);if(!key)throw new Error('KEY_NOT_AVAILABLE');keys.set(epoch,key);return decryptAutomaticMessage(message.body,key,{...context,epoch,sender:message.sender_id||(message.direction==='self'?owner:peer),id:message.id});},
  async loadDraft(){const value=await store.get('draft:'+keyPrefix);if(!value)return '';identity=identity||await store.identity(owner);return decryptDeviceDraft(value,identity,context);},
  async saveDraft(body){const number=(draftWrites.get(keyPrefix)||0)+1;draftWrites.set(keyPrefix,number);const local=identity||await store.identity(owner);const encrypted=body?await encryptDeviceDraft(body,local,context):null;if(draftWrites.get(keyPrefix)!==number)return;if(encrypted)await store.put('draft:'+keyPrefix,encrypted);else await store.delete('draft:'+keyPrefix);setProtectedFriendDraft(owner,peer,Boolean(body));},
  forget(){keys.clear();outgoing=null;identity=null;state={ready:false,status:'loading',devices:0};}
 };
 return api;
}
