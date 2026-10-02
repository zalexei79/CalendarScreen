import {useEffect,useState} from 'react';
import {normalizeVoiceCategory} from '../lib/voiceCategory.js';
import {getMoneyCategoryMeta} from '../config/constants.js';
import useCategoryPreferences from './useCategoryPreferences.js';
export default function useVoiceCategories(userId){
 const preferences=useCategoryPreferences(userId);
 const key=`dayris_money_categories:${userId||'guest'}`;
 const read=()=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string'&&v.trim()&&v.length<=60).slice(0,100):[];}catch{return [];}};
 const [state,setState]=useState(()=>({key,items:read()}));
 useEffect(()=>{setState({key,items:read()});},[key]);
 const categories=state.key===key?state.items:read();
 function add(name){
  const value=String(name||'').replace(/[«»"']/g,'').trim().slice(0,60);if(!value)return;
  preferences.remember(getMoneyCategoryMeta(value)?.key||value);
  if(getMoneyCategoryMeta(value))return;
  const existing=read();if(existing.some(item=>normalizeVoiceCategory(item)===normalizeVoiceCategory(value)))return;
  const items=[...existing,value].slice(-100);
  try{localStorage.setItem(key,JSON.stringify(items));}catch{/* Keep the current session usable when storage is unavailable. */}
  setState({key,items});
 }
 return {categories,add};
}
