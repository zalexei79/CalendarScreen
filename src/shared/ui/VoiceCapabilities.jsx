import React,{useId,useState} from 'react';
import {Plus,SlidersHorizontal,List,ChartNoAxesCombined,History,Undo2,Tags,Compass,ChevronLeft,ChevronRight,ChevronDown} from 'lucide-react';

const icons=[Plus,SlidersHorizontal,List,ChartNoAxesCombined,History,Undo2,Tags,Compass];
const labels={ru:['Записать','Исправить','Список записей','Поиск и итоги','История','Отменить','Разделы','Навигация']};

export default function VoiceCapabilities({catalog,locale='ru'}){
 const [selected,setSelected]=useState(0),[example,setExample]=useState(0),id=useId();
 const group=catalog.groups[Math.min(selected,catalog.groups.length-1)];
 const copy=(ru,en,ro,zh)=>({ru,en,ro,zh}[locale]||en);
 if(!group)return null;
 const phrases=group.phrases,phrase=phrases[example%phrases.length];
 return <section className="voice-capabilities" aria-label={catalog.title}>
  <div className="voice-discover-heading"><h2>{copy('Просто скажите','Just say it','Spune, pur și simplu','说出来就好')}</h2><p>{copy('Выберите действие. Остальное — голосом.','Choose an action. Your voice does the rest.','Alege o acțiune. Restul — prin voce.','选择操作，其余交给语音。')}</p></div>
  <div className="voice-discover-actions" role="group" aria-label={catalog.title}>
   {catalog.groups.map((item,index)=>{const Icon=icons[catalog.groups.length===4?[0,6,3,7][index]:index]||Compass;return <button type="button" key={item.title} aria-pressed={selected===index} aria-controls={id} onClick={()=>{setSelected(index);setExample(0);}}><Icon size={17} aria-hidden="true"/><span>{labels[locale]?.[index]||item.title}</span></button>;})}
  </div>
  <div className="voice-discover-example" id={id} key={group.title}>
   <div className="voice-discover-caption"><span>{copy('Попробуйте сказать','Try saying','Încearcă să spui','试着说')}</span><span>{example%phrases.length+1} / {phrases.length}</span></div>
   <p className="voice-discover-phrase" aria-live="polite">«{phrase}»</p>
   <div className="voice-discover-pagination"><span>{group.title}</span><button type="button" aria-label={copy('Предыдущий пример','Previous example','Exemplul anterior','上一个示例')} disabled={phrases.length<2} onClick={()=>setExample((example+phrases.length-1)%phrases.length)}><ChevronLeft size={17}/></button><button type="button" aria-label={copy('Следующий пример','Next example','Exemplul următor','下一个示例')} disabled={phrases.length<2} onClick={()=>setExample((example+1)%phrases.length)}><ChevronRight size={17}/></button></div>
  </div>
  <details className="voice-discover-details" key={`details-${group.title}`}><summary>{copy('Все фразы и детали','All phrases and details','Toate frazele și detaliile','全部短语与说明')}<ChevronDown size={14}/></summary><p>{group.hint}</p><ul>{phrases.map(value=><li key={value}>«{value}»</li>)}</ul></details>
 </section>;
}
