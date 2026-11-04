import {supabase} from '../../supabaseClient.js';
import {categorySyncRows,categorySyncSnapshot} from './categorySyncModel.js';
const managers=new Map();
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
const keys=owner=>({items:`dayris_money_categories:${owner}`,hidden:`dayris_deleted_categories:${owner}`,queue:`dayris_category_outbox:${owner}`,imported:`dayris_category_imported:${owner}`});
const array=value=>Array.isArray(value)?value:[];
function saveQueue(entry){try{localStorage.setItem(entry.keys.queue,JSON.stringify(entry.queue));}catch{/* Session queue is retained when storage is unavailable. */}}
function manager(owner){
 if(!managers.has(owner)){
  const k=keys(owner),queue=array(read(k.queue,[])).filter(row=>typeof row?.key==='string'&&row.key.length>0&&row.key.length<=60&&typeof row.name==='string'&&row.name.trim()&&row.name.length<=60&&typeof row.deleted==='boolean');
  managers.set(owner,{owner,keys:k,queue,count:0,busy:false,again:false});
 }
 return managers.get(owner);
}
async function sync(entry){
 if(!entry.count||navigator.onLine===false)return;
 if(entry.busy){entry.again=true;return;}
 entry.busy=true;
 try{
  if(!read(entry.keys.imported,false)){
   const rows=categorySyncRows(array(read(entry.keys.items,[])),array(read(entry.keys.hidden,[])));
   for(let offset=0;offset<Math.max(rows.length,1);offset+=200){
    const {error}=await supabase.rpc('import_money_categories',{p_owner:entry.owner,p_entries:rows.slice(offset,offset+200)});if(error)throw error;
   }
   try{localStorage.setItem(entry.keys.imported,'true');}catch{/* A repeat import is harmless. */}
  }
  while(entry.queue.length&&entry.count){
   const item=entry.queue[0];
   const {error}=await supabase.rpc('set_money_category',{p_owner:entry.owner,p_key:item.key,p_name:item.name,p_deleted:item.deleted});if(error)throw error;
   entry.queue.shift();saveQueue(entry);
  }
  if(!entry.count)return;
  const {data,error}=await supabase.from('money_category_library').select('category_key,name,deleted').eq('user_id',entry.owner);if(error)throw error;
  if(!entry.count)return;
  const value=categorySyncSnapshot(data||[],entry.queue);
  const previous={items:array(read(entry.keys.items,[])),hidden:array(read(entry.keys.hidden,[]))};
  if(JSON.stringify(previous)===JSON.stringify(value))return;
  try{localStorage.setItem(entry.keys.items,JSON.stringify(value.items));localStorage.setItem(entry.keys.hidden,JSON.stringify(value.hidden));}catch{/* Broadcast also updates mounted pickers. */}
  window.dispatchEvent(new CustomEvent('dayris-money-categories',{detail:{key:entry.keys.items,value}}));
 }catch{/* Keep local categories and queued edits; retry on reconnect/focus/poll. */}
 finally{entry.busy=false;if(entry.again){entry.again=false;void sync(entry);}}
}
export function queueCategoryChange(owner,name,deleted){
 if(!owner)return;
 const entry=manager(owner),row=categorySyncRows(deleted?[]:[name],deleted?[name]:[])[0];if(!row)return;
 entry.queue.push(row);saveQueue(entry);void sync(entry);
}
export function startCategorySync(owner){
 if(!owner)return()=>{};
 const entry=manager(owner);entry.count++;
 if(entry.count===1){
  entry.refresh=()=>{if(document.visibilityState!=='hidden')void sync(entry);};
  window.addEventListener('focus',entry.refresh);window.addEventListener('online',entry.refresh);document.addEventListener('visibilitychange',entry.refresh);
  entry.channel=supabase.channel(`money-categories:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'money_category_library',filter:`user_id=eq.${owner}`},entry.refresh).subscribe();
  entry.timer=setInterval(entry.refresh,15000);void sync(entry);
 }
 return()=>{entry.count--;if(!entry.count){clearInterval(entry.timer);void supabase.removeChannel(entry.channel);window.removeEventListener('focus',entry.refresh);window.removeEventListener('online',entry.refresh);document.removeEventListener('visibilitychange',entry.refresh);}};
}
