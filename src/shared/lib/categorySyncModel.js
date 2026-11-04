import {normalizeVoiceCategory} from './voiceCategory.js';
export function categorySyncRows(items=[],hidden=[]){
 const rows=new Map();
 for(const [names,deleted] of [[items,false],[hidden,true]])for(const name of names){
  if(typeof name!=='string'||!name.trim()||name.length>60)continue;
  const key=normalizeVoiceCategory(name);if(key)rows.set(key,{key,name:name.trim(),deleted});
 }
 return [...rows.values()];
}
export function categorySyncSnapshot(rows,pending=[]){
 const merged=new Map();
 for(const row of [...rows,...pending]){
  const key=row.category_key||row.key;
  if(typeof key==='string'&&typeof row.name==='string'&&row.name.trim()&&row.name.length<=60)merged.set(key,row);
 }
 return {items:[...merged.values()].filter(row=>!row.deleted).map(row=>row.name),hidden:[...merged.values()].filter(row=>row.deleted).map(row=>row.name)};
}
