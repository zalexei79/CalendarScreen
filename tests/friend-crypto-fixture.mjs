// Synthetic key directory used only by browser previews. It contains no private keys.
export function createKeyDirectory(snapshot){
 const devices=new Map(snapshot?.devices||[]),epochs=new Map((snapshot?.epochs||[]).map(([id,e])=>[id,{pair:e.pair,packets:new Map(e.packets)}]));
 return {devices,epochs,snapshot:()=>({devices:[...devices],epochs:[...epochs].map(([id,e])=>[id,{pair:e.pair,packets:[...e.packets]}])}),async rpc(actor,name,args){
  if(args.p_owner!==actor)return {error:{code:'42501'}};
  if(name==='friend_chat_register_device'){const previous=devices.get(args.p_device);if(previous&&(previous.owner_id!==actor||previous.public_key!==args.p_public_key))return {error:{code:'42501'}};devices.set(args.p_device,{id:args.p_device,owner_id:actor,public_key:args.p_public_key});return {data:{owner_id:actor,device_id:args.p_device}};}
  if(name==='friend_chat_keyring'){const available=[...devices.values()].filter(d=>[actor,args.p_peer].includes(d.owner_id));const matches=[...epochs.entries()].filter(([id,e])=>e.pair.includes(actor)&&e.pair.includes(args.p_peer)&&(!args.p_epochs||args.p_epochs.includes(id)));return {data:{owner_id:actor,devices:available,epochs:matches.map(([id,e])=>({id,delivered:[...e.packets.keys()]})),packets:matches.flatMap(([id,e])=>{const p=e.packets.get(args.p_device);return p?[{...p,epoch_id:id,public_key:devices.get(p.sender_device).public_key}]:[];})}};}
  if(name==='friend_chat_publish_keys'){if(devices.get(args.p_device)?.owner_id!==actor)return {error:{code:'42501'}};if(!epochs.has(args.p_epoch))epochs.set(args.p_epoch,{pair:[actor,args.p_peer],packets:new Map()});const epoch=epochs.get(args.p_epoch);for(const packet of args.p_packets)if(!epoch.packets.has(packet.recipient_device))epoch.packets.set(packet.recipient_device,{...packet,sender_device:args.p_device});return {data:{owner_id:actor,epoch_id:args.p_epoch}};}
  throw new Error('Unexpected key RPC '+name);
 }};
}
