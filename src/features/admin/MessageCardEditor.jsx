import React,{useEffect,useState} from 'react';
import {X} from 'lucide-react';
import MessageCard from '../messages/MessageCard.jsx';
import MessageChat from '../messages/MessageChat.jsx';
import {creatorCopy} from '../messages/creatorCopy.js';
import {cardLabels} from '../messages/messageCardModel.js';
import '../messages/CreatorMessages.css';
export const newMessageCard=()=>({...cardLabels({},creatorCopy('ru')),version:1});
const fields=[['sender','Подпись над заголовком'],['button','Главная кнопка без подарка'],['giftButton','Главная кнопка с подарком'],['replyButton','Кнопка перехода в чат'],['footer','Нижняя подпись'],['giftLine','Строка срока PRO · {date} — дата'],['foreverLine','PRO без ограничения срока'],['closeLabel','Название кнопки закрытия'],['savingLabel','Надпись во время сохранения']];
export function CardEditorFields({card,onChange}){
 const set=(key,value)=>onChange({...card,[key]:value});
 const inputs=list=>list.map(([key,label])=><label key={key} className="admin-field"><span>{label}</span><input id={'card-edit-'+key} maxLength={['button','giftButton','replyButton','sendReplyLabel','backLabel','closeLabel'].includes(key)?60:200} value={card[key]} onChange={e=>set(key,e.target.value)}/></label>);
 return <>
  <p>Нажмите на надпись в предпросмотре, чтобы перейти к её настройке. Пустая подпись сверху или снизу скрывается.</p>
  <details className="card-editor-group"><summary>Надписи и кнопки</summary>{inputs(fields)}</details>
  <details className="card-editor-group"><summary>Оформление</summary>{[['icon','Значок',[['auto','Автоматически'],['mail','Конверт'],['gift','Подарок'],['none','Без значка']]],['theme','Фон карточки',[['auto','Тема пользователя'],['dark','Тёмный'],['light','Светлый']]],['accent','Акцент',[['neutral','Нейтральный'],['gold','Золотой'],['blue','Синий']]]].map(([key,label,options])=><label className="admin-field" key={key}><span>{label}</span><select id={'card-edit-'+key} value={card[key]} onChange={e=>set(key,e.target.value)}>{options.map(([value,text])=><option value={value} key={value}>{text}</option>)}</select></label>)}
   <label className="admin-check"><input type="checkbox" checked={card.showExpiry} onChange={e=>set('showExpiry',e.target.checked)}/>Показывать срок подарка</label>
  </details>
  <details className="card-editor-group"><summary>Переписка</summary><label className="admin-check"><input type="checkbox" checked={card.allowReply} onChange={e=>set('allowReply',e.target.checked)}/>Показывать кнопку перехода в чат</label><p>Кнопка открывает общий диалог. Поле ввода и история переписки доступны в разделе «Сообщения».</p></details>
  <button type="button" onClick={()=>onChange(newMessageCard())}>Вернуть стандартные надписи</button>
 </>;
}
export function CardSandbox({card,title,body,gift,amount,unit}){
 const [view,setView]=useState('card'),[device,setDevice]=useState('phone'),t=creatorCopy('ru');
 useEffect(()=>{if(!card.allowReply)setView('card');},[card.allowReply]);
 const days=Math.min(36525,Math.max(1,Number(amount)||1))*(unit==='years'?365.25:1);
 const until=new Date(Date.now()+Math.min(days,36525)*86400000),date=until.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
 const message={title:title||'Заголовок',body:body||'Здесь появится ваше сообщение.',card,pro_until:gift?until.toISOString():null};
 function focus(key){const node=document.getElementById('card-edit-'+key)||(key==='title'?document.querySelector('.admin-message-layout input[maxlength="80"]'):key==='body'?document.querySelector('.admin-message-layout textarea[maxlength="4000"]'):null);if(!node)return;const group=node.closest('details');if(group)group.open=true;node.focus();node.scrollIntoView({block:'nearest'});}
 return <aside className="admin-card-sandbox"><header><span className="people-eyebrow">ПЕСОЧНИЦА УВЕДОМЛЕНИЙ</span><h2>Карточка пользователя</h2><p>Здесь можно менять текст и вид. Ничего не отправляется.</p></header>
  <div className="card-sandbox-toolbar"><label><span>Экран</span><select aria-label="Экран предпросмотра" value={device} onChange={e=>setDevice(e.target.value)}><option value="phone">Телефон</option><option value="desktop">Компьютер</option></select></label><label><span>Состояние</span><select aria-label="Состояние предпросмотра" value={view} onChange={e=>setView(e.target.value)}><option value="card">Карточка</option><option value="chat" disabled={!card.allowReply}>Переписка</option></select></label></div>
  <div className={`card-sandbox-stage card-sandbox-${device}`}><div className={`creator-inbox card-sandbox-card${view==='chat'?' card-sandbox-chat':''}${card.theme==='light'?' creator-inbox-light':''}`}>
   {view==='card'?<><button type="button" className="creator-close" aria-label={card.closeLabel} onClick={()=>focus('closeLabel')}><X size={18}/></button><MessageCard message={message} t={t} dateLabel={date} titleId="card-preview-title" onSelect={focus} onPrimary={()=>{}} onReply={card.allowReply?()=>{}:undefined}/></>:
    <MessageChat previewMessages={[{...message,id:'preview-notice',entry_key:'m:preview',direction:'admin',kind:'notice',created_at:'2026-10-29T12:00:00Z',read_at:'2026-10-29T12:01:00Z'},{id:'preview-reply',entry_key:'r:preview',direction:'user',kind:'chat',body:'Пример ответа пользователя',created_at:'2026-10-29T12:01:00Z',read_at:null}]}/>}
  </div></div><p>Дата в примере приблизительная. При выдаче PRO сервер учтёт уже имеющийся срок. Надписи сохраняются вместе с рассылкой.</p>
 </aside>;
}
