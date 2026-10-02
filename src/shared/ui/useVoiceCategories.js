import {useEffect,useRef,useState} from 'react';
import {normalizeVoiceCategory} from '../lib/voiceCategory.js';
import {getMoneyCategoryMeta} from '../config/constants.js';
import useCategoryPreferences from './useCategoryPreferences.js';
const eventName='dayris-money-categories';
function valid(items){return Array.isArray(items)?items.filter(value=>typeof value==='string'&&value.trim()&&value.length<=60):[];}
export default function useVoiceCategories(userId){
 const preferences=useCategoryPreferences(userId),cache=useRef(new Map());
 const key=`dayris_money_categories:${userId||'guest'}`,hiddenKey=`dayris_deleted_categories:${userId||'guest'}`;
 function read(fromStorage=false){
  if(!fromStorage&&cache.current.has(key))return cache.current.get(key);
  try{return {items:valid(JSON.parse(localStorage.getItem(key)||'[]')).slice(-100),hidden:valid(JSON.parse(localStorage.getItem(hiddenKey)||'[]'))};}
  catch{return cache.current.get(key)||{items:[],hidden:[]};}
 }
 const [state,setState]=useState(()=>({key,...read()}));
 useEffect(()=>{
  const refresh=event=>{
   if(event?.type===eventName&&event.detail.key!==key)return;
   if(event?.type==='storage'&&event.key&&![key,hiddenKey].includes(event.key))return;
   const next=event?.type===eventName?event.detail.value:read(event?.type==='storage');cache.current.set(key,next);setState({key,...next});
  };
  refresh();window.addEventListener(eventName,refresh);window.addEventListener('storage',refresh);
  return()=>{window.removeEventListener(eventName,refresh);window.removeEventListener('storage',refresh);};
 },[key]);
 const current=state.key===key?state:read();
 function write(value){
  cache.current.set(key,value);setState({key,...value});
  try{localStorage.setItem(key,JSON.stringify(value.items));localStorage.setItem(hiddenKey,JSON.stringify(value.hidden));}catch{/* Keep this session usable when storage is unavailable. */}
  window.dispatchEvent(new CustomEvent(eventName,{detail:{key,value}}));
 }
 function add(name){
  const value=String(name||'').replace(/[«»"']/g,'').trim().slice(0,60);if(!value)return;
  const existing=read(),id=normalizeVoiceCategory(value),canonical=getMoneyCategoryMeta(value)?.key||existing.items.find(item=>normalizeVoiceCategory(item)===id)||value;
  preferences.remember(canonical);
  write({items:getMoneyCategoryMeta(value)||existing.items.some(item=>normalizeVoiceCategory(item)===id)?existing.items:[...existing.items,value].slice(-100),hidden:existing.hidden.filter(item=>normalizeVoiceCategory(item)!==id)});
  return canonical;
 }
 function remove(name){
  if(normalizeVoiceCategory(name)===normalizeVoiceCategory('Другое'))return;
  const existing=read(),id=normalizeVoiceCategory(name);
  write({items:existing.items.filter(item=>normalizeVoiceCategory(item)!==id),hidden:[...existing.hidden.filter(item=>normalizeVoiceCategory(item)!==id),name]});
  preferences.forget(name);
 }
 return {categories:current.items,hidden:current.hidden,add,remove};
}
