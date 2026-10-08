import {createPersistentAuthStorage} from '../../features/auth/persistentAuthStorage.js';
let persistent;
const storage=()=>persistent||(persistent=createPersistentAuthStorage());
const key=owner=>`dayris_voice_widget_devices_${owner}`;
const valid=value=>Array.isArray(value)?value.filter(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id)).slice(-20):[];
export async function rememberWidgetDevice(owner,id,store=storage()){
 let previous=[];try{previous=valid(JSON.parse(await store.getItem(key(owner))||'[]'));}catch{}
 await store.setItem(key(owner),JSON.stringify([...new Set([...previous,id])].slice(-20)));
}
export async function revokeBoundWidgetDevices(client,owner,store=storage()){
 if(!owner)return;
 let ids=[];try{ids=valid(JSON.parse(await store.getItem(key(owner))||'[]'));}catch{}
 if(!ids.length)return;
 const {data}=await client.auth.getSession();
 if(data.session?.user?.id!==owner)throw new Error('ACCOUNT_CHANGED');
 const {error}=await client.from('voice_widget_devices').update({revoked_at:new Date().toISOString()}).in('id',ids);
 if(error)throw new Error('WIDGET_DISCONNECT_FAILED');
 await store.removeItem(key(owner));
}
export function widgetDisconnectError(language){const locale=String(language).toLowerCase().split(/[-_]/u)[0];return locale==='zh'?'无法断开麦克风小组件，请检查网络后重试。':locale==='en'?'Could not disconnect the microphone widget. Check your connection and retry.':locale==='ro'?'Nu am putut deconecta microfonul. Verifică conexiunea și reîncearcă.':'Не удалось отключить виджет микрофона. Проверьте интернет и повторите выход.';}
