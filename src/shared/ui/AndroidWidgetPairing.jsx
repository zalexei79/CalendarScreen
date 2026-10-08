import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../../supabaseClient.js';
import {widgetLocale} from '../lib/widgetVoiceConversation.js';
import {widgetSetupActive,finishWidgetSetup} from '../lib/widgetPairing.js';
import {currentWidgetHandshake,watchWidgetHandshake,clearWidgetHandshake} from './androidWidgetBridge.js';
import {rememberWidgetDevice,revokeBoundWidgetDevices} from '../lib/widgetDeviceBinding.js';
const text={ru:{title:'Микрофон на рабочем столе',body:'Подключите виджет к этому аккаунту. Затем расходы и доходы можно записывать прямо с домашнего экрана Android.',connect:'Подключить микрофон',wait:'Ожидаю подключение Android…',saving:'Подключаю…',done:'Микрофон подключён',error:'Не удалось подключить. Проверьте связь и попробуйте снова.'},en:{title:'Home screen microphone',body:'Connect the widget to this account. Then record expenses and income directly from your Android home screen.',connect:'Connect microphone',wait:'Waiting for Android…',saving:'Connecting…',done:'Microphone connected',error:'Could not connect. Check your connection and retry.'},ro:{title:'Microfon pe ecranul principal',body:'Conectează widgetul la acest cont. Apoi înregistrează cheltuieli și venituri direct de pe ecranul principal Android.',connect:'Conectează microfonul',wait:'Aștept conexiunea Android…',saving:'Se conectează…',done:'Microfon conectat',error:'Conectarea a eșuat. Verifică conexiunea și reîncearcă.'},zh:{title:'主屏幕麦克风',body:'将小组件连接到此账号，然后即可在安卓主屏幕上记录收入和支出。',connect:'连接麦克风',wait:'正在等待安卓连接…',saving:'正在连接…',done:'麦克风已连接',error:'连接失败，请检查网络后重试。'}};
export default function AndroidWidgetPairing({ready,userId,language,currency,categories}){
 const [active]=useState(()=>{let storage;try{storage=window.sessionStorage;}catch{}return widgetSetupActive(window.location,storage);});
 const [link,setLink]=useState(currentWidgetHandshake),[status,setStatus]=useState('idle');
 const current=useRef(currentWidgetHandshake()),busy=useRef(false),prefs=useRef(null);prefs.current={ready,userId,language,currency,categories};
 useEffect(()=>{
  return watchWidgetHandshake(handshake=>{
   current.current=handshake;setLink(handshake);
   if(handshake.confirmed){
    setStatus('done');let storage;try{storage=window.sessionStorage;}catch{}
    finishWidgetSetup(window.location,window.history,storage);
    handshake.port.postMessage(JSON.stringify({type:'dayris.widget.finish',nonce:handshake.nonce}));clearWidgetHandshake();
   }
  });
 },[active]);
 if(!active||!ready)return null;
 const labels=text[widgetLocale(language)];
 async function connect(){
  if(busy.current||!current.current)return;
  busy.current=true;setStatus('saving');const handshake=current.current,owner=prefs.current.userId;
  try{
   const {data:sessionData}=await supabase.auth.getSession();
   if(!sessionData.session?.access_token||sessionData.session.user.id!==owner)throw new Error('ACCOUNT_CHANGED');
   await revokeBoundWidgetDevices(supabase,owner);
   const {data,error}=await supabase.functions.invoke('widget-voice',{body:{action:'pair',settings:{locale:widgetLocale(prefs.current.language),currency:prefs.current.currency,categories:prefs.current.categories}},headers:{Authorization:`Bearer ${sessionData.session.access_token}`}});
   if(error||!data?.secret)throw new Error('PAIR_FAILED');
   if(owner!==prefs.current.userId||current.current.nonce!==handshake.nonce){await supabase.from('voice_widget_devices').update({revoked_at:new Date().toISOString()}).eq('id',data.id);throw new Error('ACCOUNT_CHANGED');}
   await rememberWidgetDevice(owner,data.id);
   if(owner!==prefs.current.userId||current.current.nonce!==handshake.nonce)throw new Error('ACCOUNT_CHANGED');
   handshake.port.postMessage(JSON.stringify({type:'dayris.widget.paired',nonce:handshake.nonce,grant:data}));
  }catch{setStatus('error');}finally{busy.current=false;}
 }
 return <aside style={{position:'fixed',zIndex:12000,bottom:'max(24px, env(safe-area-inset-bottom))',left:'50%',transform:'translateX(-50%)',width:'min(90vw, 420px)',padding:24,borderRadius:24,background:'#191b1f',color:'#f4f1e9',border:'1px solid #796a47',boxShadow:'0 18px 70px #0009'}} aria-live="polite">
  <strong style={{fontSize:20}}>{labels.title}</strong><p style={{fontSize:14,lineHeight:1.5,color:'#b8b8bc'}}>{labels.body}</p>
  <button type="button" disabled={!link||status==='saving'||status==='done'} onClick={connect} style={{width:'100%',padding:14,borderRadius:14,background:'#dcc589',color:'#191b1f',fontWeight:600,border:0}}>{status==='done'?labels.done:status==='saving'?labels.saving:!link?labels.wait:labels.connect}</button>
  {status==='error'&&<p role="alert">{labels.error}</p>}
 </aside>;
}
