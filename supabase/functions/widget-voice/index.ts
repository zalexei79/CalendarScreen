import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {widgetSettings,widgetVoiceTurn,widgetSpokenReply} from './conversation.mjs';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');

Deno.serve(async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
 try{
  const raw=await request.text();if(raw.length>12000)return response({error:'REQUEST_TOO_LARGE'},413);
  const body=JSON.parse(raw),authorization=request.headers.get('authorization')||'';
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='pair'){
   if(!authorization.startsWith('Bearer '))return response({error:'UNAUTHORIZED'},401);
   const {data,error}=await db.auth.getUser(authorization.slice(7));
   if(error||!data.user)return response({error:'UNAUTHORIZED'},401);
   const {count,error:countError}=await db.from('voice_widget_devices').select('id',{count:'exact',head:true}).eq('user_id',data.user.id).is('revoked_at',null).gt('expires_at',new Date().toISOString());
   if(countError)throw new Error('DATABASE_ERROR');if((count||0)>=10)return response({error:'DEVICE_LIMIT'},409);
   const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
   const settings=widgetSettings(body.settings),id=crypto.randomUUID();
   const created=await db.from('voice_widget_devices').insert({id,user_id:data.user.id,secret_hash:await hash(secret),settings});
   if(created.error)throw new Error('DATABASE_ERROR');
   return response({id,secret,locale:settings.locale,endpoint:`${url}/functions/v1/widget-voice`});
  }
  if(!['turn','revoke'].includes(body.action)||!uuid.test(body.deviceId)||(body.action==='turn'&&!uuid.test(body.requestId))||!/^Widget [a-f0-9]{64}$/.test(authorization))return response({error:'UNAUTHORIZED'},401);
  const {data:device,error}=await db.from('voice_widget_devices').select('*').eq('id',body.deviceId).eq('secret_hash',await hash(authorization.slice(7))).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error)throw new Error('DATABASE_ERROR');if(!device)return response({error:'DEVICE_EXPIRED'},401);
  if(body.action==='revoke'){
   const revoked=await db.from('voice_widget_devices').update({revoked_at:new Date().toISOString(),conversation:null}).eq('id',device.id);
   if(revoked.error)throw new Error('DATABASE_ERROR');return response({status:'revoked'});
  }
  if(typeof body.phrase!=='string'||body.phrase.length>1500||!body.phrase.trim())return response({error:'INVALID_PHRASE'},400);
  if(typeof body.timezone!=='string'||body.timezone.length>80)return response({error:'INVALID_TIMEZONE'},400);
  let parts:Record<string,string>;
  try{parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:body.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(part=>[part.type,part.value]));}
  catch{return response({error:'INVALID_TIMEZONE'},400);}
  const todayKey=`${parts.year}-${parts.month}-${parts.day}`;
  const alternatives=Array.isArray(body.alternatives)?body.alternatives.filter(value=>typeof value==='string'&&value.length<=1500).slice(0,4):[];
  const confidence=Number.isFinite(body.confidence)?body.confidence:0;
  const fingerprint=await hash(JSON.stringify({phrase:body.phrase,timezone:body.timezone,confidence,alternatives,createdAt:body.createdAt}));
  const cached=await db.from('voice_widget_turns').select('fingerprint,response').eq('device_id',device.id).eq('request_id',body.requestId).maybeSingle();
  if(cached.error)throw new Error('DATABASE_ERROR');
  if(cached.data)return cached.data.fingerprint===fingerprint?response(cached.data.response):response({error:'REQUEST_CONFLICT'},409);
  // Cached responses live for 48h. Uncached requests older than 36h cannot
  // execute again after cache cleanup, even if the phone retained a lost reply.
  if(!Number.isFinite(body.createdAt)||body.createdAt>Date.now()+5*60*1000||Date.now()-body.createdAt>36*60*60*1000)return response({error:'INVALID_REQUEST_TIMESTAMP'},400);
  const turn=widgetVoiceTurn({phrase:body.phrase,context:device.conversation,settings:device.settings,todayKey,confidence,alternatives});
  const reply={status:turn.status,reply:turn.reply,speech:widgetSpokenReply(turn.reply,device.settings.locale),listenAgain:turn.status==='clarify',savedCount:turn.entries.length};
  const committed=await db.rpc('commit_voice_widget_turn',{p_device:device.id,p_request:body.requestId,p_fingerprint:fingerprint,p_revision:device.revision,p_context:turn.context,p_response:reply,p_entries:turn.entries,p_today:todayKey,p_time:`${parts.hour}:${parts.minute}`});
  if(committed.error){const message=committed.error.message||'';return response({error:message.includes('TURN_CONFLICT')?'TURN_CONFLICT':message.includes('RATE_LIMITED')?'RATE_LIMITED':'SAVE_FAILED'},409);}
  return response(committed.data);
 }catch{return response({error:'SERVICE_UNAVAILABLE'},503);}
});
