import React,{useRef,useState} from 'react';
import CategoryPicker from './CategoryPicker.jsx';

const labels={
 ru:{category:'Категория',choose:'Выберите категорию',create:'Создать',date:'Дата',amount:'Сумма',voice:'Ответить голосом',done:'Введите сумму и нажмите «Готово» на клавиатуре.'},
 en:{category:'Category',choose:'Choose category',create:'Create',date:'Date',amount:'Amount',voice:'Reply by voice',done:'Enter the amount, then tap Done on the keyboard.'},
 ro:{category:'Categorie',choose:'Alege categoria',create:'Creează',date:'Data',amount:'Sumă',voice:'Răspunde vocal',done:'Introdu suma, apoi apasă Gata pe tastatură.'},
 zh:{category:'类别',choose:'选择类别',create:'创建',date:'日期',amount:'金额',voice:'语音回答',done:'输入金额后，点击键盘上的完成。'},
};
export default function VoiceReplyControls({field,locale,defaultCurrency,walletAvailable,categories,item,today,onReply,onVoice,userId,isLight,onPickerOpen}){
 const [value,setValue]=useState(''),submitted=useRef(false),c=labels[locale]||labels.ru;
 function reply(answer){if(!answer.trim()||submitted.current)return;submitted.current=true;onReply(answer);}
 const routes={ru:[['календарь','Календарь'],['кошелек','Кошелёк'],['оба','В оба']],en:[['calendar','Calendar'],['wallet','Wallet'],['both','Both']],ro:[['calendar','Calendar'],['wallet','Portofel'],['both','Ambele']],zh:[['日历','日历'],['钱包','钱包'],['两者','两者']]}[locale];
 const signs={ru:[['расход','Расход'],['доход','Доход']],en:[['expense','Expense'],['income','Income']],ro:[['cheltuiala','Cheltuială'],['venit','Venit']],zh:[['支出','支出'],['收入','收入']]}[locale];
 const options=field==='destination'?routes.slice(0,walletAvailable?3:1):field==='currency'?[...(defaultCurrency?[[locale==='zh'?'是':locale==='en'?'yes':locale==='ro'?'da':'да',{ru:'Да',en:'Yes',ro:'Da',zh:'是'}[locale]]]:[]),['RUB','₽ RUB'],['EUR','€ EUR'],['MDL','L MDL'],['USD','$ USD'],['CNY','¥ CNY']]:signs;
 return <div className="calendar-voice-replies">
  {field==='category'?<div className="calendar-voice-category-reply">
   <CategoryPicker ariaLabel={c.category} options={categories} onChange={reply} userId={userId} language={locale} isLight={isLight} onOpen={onPickerOpen}/>
   {item&&<button type="button" onClick={()=>reply((locale==='zh'?'创建类别':'создай категорию ')+item)}>{c.create} «{item}»</button>}
  </div>:field==='date'?<input aria-label={c.date} type="date" max={today} value={value} onChange={event=>{submitted.current=false;setValue(event.target.value);reply(event.target.value);}}/>:field==='amount'?<>
   <input aria-label={c.amount} inputMode="decimal" enterKeyHint="done" value={value} onChange={event=>{submitted.current=false;setValue(event.target.value);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();reply(event.currentTarget.value);}}} onBlur={event=>{if(!event.relatedTarget?.closest('button'))reply(event.currentTarget.value);}} placeholder="0"/>
   <p className="calendar-voice-help-note">{c.done}</p>
  </>:<div className="calendar-voice-options">{options.map(([answer,label])=><button key={answer} type="button" onClick={()=>reply(answer)}>{label}</button>)}</div>}
  <div className="calendar-voice-reply-actions"><button type="button" onClick={onVoice}>{c.voice}</button></div>
 </div>;
}
