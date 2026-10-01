import React, {useEffect, useState} from 'react';
import {Delete} from 'lucide-react';
import './AmountEntry.css';

export function editAmount(value, key) {
  const current=String(value || '').replace(',', '.');
  if(key==='delete') return current.slice(0,-1);
  if(key==='clear') return '';
  if(key==='.') return current.includes('.') ? current : `${current || '0'}.`;
  if(!/^\d$/.test(key)) return current;
  if(current.replace('.','').length>=14) return current;
  return current==='0' ? key : current+key;
}

export const AmountInput=React.forwardRef(function AmountInput(props,ref) {
  const [touch,setTouch]=useState(()=>window.matchMedia('(pointer:coarse)').matches);
  useEffect(()=>{
    const query=window.matchMedia('(pointer:coarse)');
    const change=()=>setTouch(query.matches);
    query.addEventListener('change',change);
    return ()=>query.removeEventListener('change',change);
  },[]);
  return <input {...props} ref={ref} autoFocus={false} readOnly={touch} inputMode={touch ? 'none' : 'decimal'}/>;
});

export default function AmountKeypad({value,onChange,language='ru',isLight}) {
  const locale=language==='en'?'en':language==='md'||language==='ro'?'ro':'ru';
  const copy={ru:['Ввод суммы','Удалить цифру','Очистить','Быстрые суммы'],en:['Enter amount','Delete digit','Clear','Quick amounts'],ro:['Introdu suma','Șterge cifra','Golește','Sume rapide']}[locale];
  return <div className="amount-keypad" data-light={Boolean(isLight)} role="group" aria-label={copy[0]}>
    <div className="amount-presets" role="group" aria-label={copy[3]}>
      {[10,50,100,500].map(amount=><button type="button" key={amount} onClick={()=>onChange(String(amount))}>{amount}</button>)}
      <button type="button" onClick={()=>onChange('')} disabled={!value}>{copy[2]}</button>
    </div>
    <div className="amount-digits">
      {['1','2','3','4','5','6','7','8','9','.','0','delete'].map(key=><button type="button" key={key} aria-label={key==='delete'?copy[1]:key} onClick={()=>onChange(editAmount(value,key))}>{key==='delete'?<Delete size={18}/>:key==='.'?',':key}</button>)}
    </div>
  </div>;
}
