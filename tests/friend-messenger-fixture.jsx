// Isolated preview: all RPCs below use synthetic data, with no network or credentials.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import HomeFriends from '../src/features/social/HomeFriends.jsx';
import {FriendChatDialog} from '../src/features/social/FriendMessaging.jsx';
import {sharedDayMessage,sharedStreakMessage} from '../src/features/social/sharedDayMessage.js';
import {importFriendKey,lockFriendMessage} from '../src/features/messages/friendMessage.js';
const owner='22222222-2222-4222-8222-222222222222',anna='33333333-3333-4333-8333-333333333333',max='44444444-4444-4444-8444-444444444444',maria='55555555-5555-4555-8555-555555555555';
const people=[{user_id:anna,display_name:'Анна',handle:'1048',avatar_path:null},{user_id:max,display_name:'Максим',handle:'2086',avatar_path:null},{user_id:maria,display_name:'Мария',handle:'3015',avatar_path:null}];
const row=(id,sender,recipient,body,time)=>({id,entry_key:'f:'+id,sender_id:sender,recipient_id:recipient,body,created_at:'2026-11-02T'+time+':00Z',read_at:sender===owner?'2026-11-02T12:00:00Z':null,kind:'chat'});
const messages=[row('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',anna,owner,'Как прошёл твой день? 🤍','08:40'),row('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',owner,anna,'Закрыл все планы. Давай отметим маленькую победу!','08:42'),row('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',anna,owner,sharedDayMessage({day:'2026-11-02',entries:4,totals:[]}), '08:44'),row('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',owner,anna,sharedStreakMessage({currentStreak:12,paused:false,serverDate:'2026-11-02'}),'08:45'),row('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',max,owner,'Давай начнём неделю с хорошей привычки 🔥','07:35')];
const fixture=window.friendFixture={owner,people,messages,requests:[],readIds:[],failNext:false,denied:false};
function social(){const friends=fixture.owner===owner?people.map(p=>{const thread=messages.filter(m=>[m.sender_id,m.recipient_id].includes(p.user_id)&&[m.sender_id,m.recipient_id].includes(owner)),last=thread.at(-1);return {...p,unread_count:thread.filter(m=>m.recipient_id===owner&&!m.read_at).length,last_message:last?.body||null,last_at:last?.created_at||null};}):[];return {owner_id:fixture.owner,friends,incoming:fixture.owner===owner?[{user_id:'66666666-6666-4666-8666-666666666666',display_name:'Александр',handle:'4081',state:'pending',requested_by:'66666666-6666-4666-8666-666666666666'}]:[],outgoing:[],blocked:[]};}
fixture.rpc=async(name,args={})=>{
 fixture.requests.push({name,args:structuredClone(args)});
 if(name==='social_own_profile')return {data:{user_id:fixture.owner,display_name:'Алексей',handle:'1001',discoverable:true}};
 if(name==='social_friends')return {data:social()};
 if(name==='social_friend_count')return {data:3};
 if(name==='friend_chat_peer')return {data:people.find(p=>p.user_id===args.p_peer)};
 if(name==='friend_chat_thread'){if(fixture.denied)return {error:{code:'42501'}};const thread=messages.filter(m=>[m.sender_id,m.recipient_id].includes(args.p_peer)&&[m.sender_id,m.recipient_id].includes(fixture.owner));return {data:{owner_id:fixture.owner,rows:thread.map(m=>({...m,direction:m.sender_id===fixture.owner?'self':'peer'})),has_more:false}};}
 if(name==='friend_chat_read'){for(const id of args.p_ids){const m=messages.find(m=>m.id===id);if(m){m.read_at=new Date().toISOString();fixture.readIds.push(id);}}return {data:null};}
 if(name==='friend_chat_send'){
  if(args.p_owner!==fixture.owner||fixture.denied)return {error:{code:'42501'}};
  const existing=messages.find(m=>m.id===args.p_request_id);if(existing&&existing.body!==args.p_body)return {error:{code:'40001'}};
  if(!existing)messages.push({...row(args.p_request_id,fixture.owner,args.p_peer,args.p_body,'12:00'),created_at:new Date(Date.now()+messages.length*1000).toISOString(),read_at:null});
  if(fixture.failNext){fixture.failNext=false;return {error:{code:'503',message:'Simulated lost acknowledgement'}};}
  return {data:{id:args.p_request_id}};
 }
 if(name==='social_day_history')return {data:{owner_id:fixture.owner,day:args.p_day,entries:4,totals:[{currency:'USD',amount:85}],records:[]}};
 if(name==='social_friend_action')return {data:social()};
 if(name==='social_find')return {data:{...people[0],viewer_id:fixture.owner,relationship:'accepted'}};
 return {data:null};
};
fixture.receiveLocked=async(code,text)=>{const secret=await importFriendKey(code),id=crypto.randomUUID();messages.push({...row(id,anna,owner,await lockFriendMessage(text,secret.key,{owner,peer:anna,sender:anna,id}),'12:05'),created_at:new Date(Date.now()+60000).toISOString()});window.dispatchEvent(new Event('focus'));return id;};
function Fixture(){const [user,setUser]=useState(owner);fixture.changeOwner=id=>{fixture.owner=id;setUser(id);};return <><div className="fixture-background"><b>DAYRIS</b><p>Календарь важных дней</p><button onClick={()=>window.dispatchEvent(new CustomEvent('dayris:friends-home',{detail:{userId:user}}))}>Открыть друзей</button></div><HomeFriends userId={user} language="ru"/><FriendChatDialog userId={user} language="ru"/></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
