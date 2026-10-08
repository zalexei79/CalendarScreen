import {useCallback,useEffect,useState} from 'react';
const storageKey=owner=>`dayris_savings_plan:${owner||'guest'}`;
function read(owner){
 try{const value=JSON.parse(localStorage.getItem(storageKey(owner))||'null');
  if(value?.version!==1||!Array.isArray(value.actions)||!['USD','EUR','MDL','RUB','CNY'].includes(value.currency))return null;
  const actions=value.actions.filter(item=>typeof item.key==='string'&&typeof item.category==='string'&&['skip','reduce'].includes(item.choice)&&Number.isFinite(item.saving)&&item.saving>0);
  if(!actions.length)return null;
  return {...value,actions,saving:actions.reduce((sum,item)=>sum+item.saving,0),reminders:value.reminders===true,period:typeof value.period==='string'?value.period:''};
 }catch{return null;}
}
export default function useSavingsPlan(owner){
 const [stored,setStored]=useState(()=>({owner,plan:read(owner)}));
 useEffect(()=>{setStored({owner,plan:read(owner)});},[owner]);
 useEffect(()=>{const sync=event=>{if(event.key===storageKey(owner))setStored({owner,plan:read(owner)});};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[owner]);
 const save=useCallback(plan=>{localStorage.setItem(storageKey(owner),JSON.stringify({...plan,version:1}));setStored({owner,plan:{...plan,version:1}});},[owner]);
 const clear=useCallback(()=>{localStorage.removeItem(storageKey(owner));setStored({owner,plan:null});},[owner]);
 return {plan:stored.owner===owner?stored.plan:null,save,clear};
}
