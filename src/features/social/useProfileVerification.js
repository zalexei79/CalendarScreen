import {useEffect,useState} from 'react';
import {supabase} from '../../supabaseClient';
const entries=new Map(),pending=new Set();let scheduled=false;
function request(key){pending.add(key);if(scheduled)return;scheduled=true;setTimeout(flush,20);}
async function flush(){scheduled=false;const keys=[...pending];pending.clear();const owners=[...new Set(keys.map(key=>entries.get(key)?.owner).filter(Boolean))];for(const owner of owners){const group=keys.filter(key=>entries.get(key)?.owner===owner);for(let offset=0;offset<group.length;offset+=100){const batch=group.slice(offset,offset+100);let verified=[];try{const {data,error}=await supabase.rpc('social_verified_profiles',{p_users:batch.map(key=>entries.get(key).user),p_owner:owner});if(!error&&data?.owner_id===owner)verified=data.users||[];}catch{/* Fail closed. */}for(const key of batch){const item=entries.get(key);if(item){item.value=verified.includes(item.user);item.updated=Date.now();item.listeners.forEach(listener=>listener(item.value));}}}}}
export default function useProfileVerification(user,owner){
 const key=user&&owner?`${owner}:${user}`:'', [state,setState]=useState({key:'',value:false});
 useEffect(()=>{if(!key)return;let item=entries.get(key);if(!item){item={user,owner,value:false,updated:0,listeners:new Set()};entries.set(key,item);}const update=value=>setState({key,value});item.listeners.add(update);update(item.value);if(Date.now()-item.updated>30000)request(key);const refresh=()=>{if(document.visibilityState!=='hidden')request(key);};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('dayris:verification-changed',refresh);return()=>{item.listeners.delete(update);clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('dayris:verification-changed',refresh);};},[key]);
 return state.key===key&&state.value;
}
