import {normalizeVoiceCategory} from './voiceCategory.js';
export const UNCATEGORIZED='Другое';
export function categoryRemovalTargets(records,name,isMoney){
 const id=normalizeVoiceCategory(name);
 if(!id||id===normalizeVoiceCategory(UNCATEGORIZED))return [];
 return Object.entries(records||{}).flatMap(([dateKey,items])=>(items||[])
  .filter(item=>item.id!=null&&isMoney(item)&&normalizeVoiceCategory(item.instrument)===id)
  .map(item=>({dateKey,id:item.id,instrument:item.instrument})));
}
export function detachCategoryLabels(records,targets){
 const selected=new Map(targets.map(item=>[`${item.dateKey}:${item.id}`,normalizeVoiceCategory(item.instrument)]));
 return Object.fromEntries(Object.entries(records).map(([dateKey,items])=>[dateKey,items.map(item=>
  selected.get(`${dateKey}:${item.id}`)===normalizeVoiceCategory(item.instrument)?{...item,instrument:UNCATEGORIZED}:item)]));
}
