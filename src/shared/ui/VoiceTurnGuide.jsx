import React from 'react';

const copy={
 ru:{start:'Можно говорить своими словами',entry:'Потратил 50 {currency} на кофе',query:'Сколько потратил сегодня?',help:'Что ты умеешь?',reply:'Ответьте коротко',category:'на продукты',income:'зарплата',amount:'70',date:'вчера',save:'сохрани',cancel:'отмена',known:'Понял покупок',missing:'Нужна категория'},
 en:{start:'Speak in your own words',entry:'Spent 50 {currency} on coffee',query:'How much did I spend today?',help:'What can you do?',reply:'A short answer is enough',category:'on groceries',income:'salary',amount:'70',date:'yesterday',save:'save',cancel:'cancel',known:'Purchases understood',missing:'Category needed'},
 ro:{start:'Vorbește cu cuvintele tale',entry:'Am cheltuit 50 {currency} pe cafea',query:'Cât am cheltuit astăzi?',help:'Ce poți face?',reply:'Răspunde pe scurt',category:'pe produse',income:'salariu',amount:'70',date:'ieri',save:'salvează',cancel:'anulează',known:'Cumpărături înțelese',missing:'Lipsește categoria'},
 zh:{start:'用自己的话说就可以',entry:'咖啡花了50{currency}',query:'今天花了多少钱？',help:'你能做什么？',reply:'简短回答即可',category:'用于食品',income:'工资',amount:'70',date:'昨天',save:'保存',cancel:'取消',known:'已理解的购买',missing:'请补充类别'},
};
const currencies={ru:{MDL:'лей',USD:'долларов',EUR:'евро',RUB:'рублей',CNY:'юаней'},en:{MDL:'MDL',USD:'USD',EUR:'EUR',RUB:'RUB',CNY:'CNY'},ro:{MDL:'lei',USD:'USD',EUR:'EUR',RUB:'RUB',CNY:'CNY'},zh:{MDL:'摩尔多瓦列伊',USD:'美元',EUR:'欧元',RUB:'卢布',CNY:'元'}};

export default function VoiceTurnGuide({locale,phrase,field,draft,batch,defaultCurrency,categories=[],onReply,busy,recovering=false}){
 const c=copy[locale]||copy.en,currency=currencies[locale]?.[draft?.currency||defaultCurrency]||defaultCurrency||'MDL';
 if(!field){
  if(phrase&&!recovering||draft||busy)return null;
  return <div className="voice-turn-guide voice-turn-starter"><p>{recovering?({ru:'Попробуйте так',en:'Try saying this',ro:'Încearcă așa',zh:'试着这样说'}[locale]):c.start}</p><div><small>{locale==='ru'?'Записать':locale==='ro'?'Înregistrează':locale==='zh'?'记一笔':'Record'}</small><span>«{c.entry.replace('{currency}',currency)}»</span></div><div><small>{locale==='ru'?'Спросить':locale==='ro'?'Întreabă':locale==='zh'?'提问':'Ask'}</small><span>«{c.query}»</span></div><button type="button" disabled={busy} onClick={()=>onReply(c.help)}>{c.help}<span aria-hidden="true">↗</span></button></div>;
 }
 const names=categories.filter(item=>!item.type||item.type===draft?.sign).map(item=>typeof item==='string'?item:item.value).filter(Boolean);
 const examples=field==='category'?names.slice(0,2).map(name=>`${locale==='ru'?'на':locale==='ro'?'pe':locale==='zh'?'用于':'on'} ${name}`):field==='amount'?[`70${draft?.currency?'':' '+currency}`]:field==='currency'?[currency]:field==='date'?[c.date]:field==='destination'?[{ru:'в календарь',en:'to calendar',ro:'în calendar',zh:'到日历'}[locale]]:field==='sign'?({ru:['это расход','это доход'],en:['expense','income'],ro:['cheltuială','venit'],zh:['支出','收入']}[locale]):[];
 if(field==='category'&&!examples.length)examples.push(draft?.sign==='plus'?c.income:c.category);
 return <div className="voice-turn-guide voice-turn-followup" key={field}>
  {batch&&<div className="voice-turn-understood"><p>{c.known}: {batch.states.filter(state=>state.entry).length} / {batch.states.length}</p>{batch.states.map((state,index)=>{const entry=state.entry||state.draft;return <div key={index} data-pending={Boolean(state.draft)}><span>{entry.category||c.missing}</span><strong>{entry.amount} {entry.currency}</strong></div>;})}</div>}
  <p>{c.reply}</p><div className="voice-turn-examples">{examples.map(example=><button type="button" key={example} disabled={busy} onClick={()=>onReply(example)}>«{example}»</button>)}</div>
 </div>;
}
