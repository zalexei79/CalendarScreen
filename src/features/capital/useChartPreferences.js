import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../supabaseClient.js';
import {cleanChartPreferences,defaultChartPreferences} from './chartAnalysis.js';
export function useChartPreferences(userId,asset){
 const key=`dayris_chart:${userId||'guest'}:${asset.quote_source}:${asset.symbol}`;
 const [preferences,setPreferences]=useState(()=>{try{return cleanChartPreferences(JSON.parse(localStorage.getItem(key)),asset.quote_source);}catch{return defaultChartPreferences;}});
 const finalPreferences=useRef(preferences);finalPreferences.current=preferences;
 const [status,setStatus]=useState(''),[ready,setReady]=useState(false);const touched=useRef(false),revision=useRef(0);
 useEffect(()=>{let active=true;if(!userId){setReady(true);return;}
 supabase.from('capital_chart_preferences').select('timeframe,sma,rsi,volume').eq('user_id',userId).eq('provider',asset.quote_source).eq('symbol',asset.symbol).maybeSingle().then(({data,error})=>{if(!active)return;if(data&&!touched.current)setPreferences(cleanChartPreferences(data,asset.quote_source));if(error)setStatus('local');setReady(true);});
 return()=>{active=false;};},[key]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}
 if(!ready||!touched.current||!userId)return;const version=++revision.current;setStatus('saving');
 const timer=setTimeout(()=>{supabase.from('capital_chart_preferences').upsert({user_id:userId,provider:asset.quote_source,symbol:asset.symbol,...preferences},{onConflict:'user_id,provider,symbol'}).then(({error})=>{if(version===revision.current)setStatus(error?'local':'saved');});},700);
 return()=>{clearTimeout(timer);revision.current++;};},[key,preferences,ready]);
 useEffect(()=>()=>{if(userId&&touched.current){void supabase.from('capital_chart_preferences').upsert({user_id:userId,provider:asset.quote_source,symbol:asset.symbol,...finalPreferences.current},{onConflict:'user_id,provider,symbol'}).then(()=>{});}},[key]);
 function change(update){touched.current=true;setPreferences(prev=>cleanChartPreferences({...prev,...update},asset.quote_source));}
 return{preferences,change,status};
}
