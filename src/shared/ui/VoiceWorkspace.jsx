import React from 'react';
import {createPortal} from 'react-dom';
import {Mic,Settings2,X,ChevronDown,ChevronUp} from 'lucide-react';
import VoiceSuggestions from './VoiceSuggestions.jsx';

export default function VoiceWorkspace({locale,isLight,phrase,status,help,contextLabel,onClose,onExpand,onListen,onSuggestion,listening,busy,settings,children,resultKey,choices=[],compact=false}) {
 const ru=locale==='ru',ro=locale==='ro',zh=locale==='zh';
 const copy=(r,e,m,z)=>ru?r:ro?m:zh?z:e;
 return createPortal(<section className="voice-workspace calendar-voice-control" data-light={Boolean(isLight)} data-compact={compact} role="region" aria-label={copy('Голосовой помощник','Voice assistant','Asistent vocal','语音助手')}>
  <header className="voice-workspace-header"><span className="voice-workspace-brand"><span className="voice-workspace-orb" data-listening={listening}><Mic size={15}/></span>DAYRIS <small>VOICE</small></span>{compact&&<button className="voice-workspace-expand" type="button" aria-label={copy('Развернуть помощника','Expand assistant','Extinde asistentul','展开助手')} onClick={onExpand}><ChevronUp size={18}/></button>}<button type="button" aria-label={copy('Закрыть голосовой режим','Close voice mode','Închide modul vocal','关闭语音模式')} disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className="voice-workspace-scroll">
   {contextLabel&&<p className="voice-workspace-context">{contextLabel}</p>}
   <div className="voice-workspace-heard"><p className="voice-workspace-label">{phrase?copy('Вы сказали','You said','Ai spus','你说了'):copy('Начните с простого','Start with something simple','Începe cu ceva simplu','从简单的开始')}</p><p className="voice-workspace-phrase" aria-live="polite">{phrase||copy('«Вчера потратил 250 на продукты»','“Yesterday I spent 250 on groceries”','„Ieri am cheltuit 250 pe alimente”','“昨天买食品花了250”')}</p></div>
   <p className="voice-workspace-status" role="status"><span data-listening={listening}/>{status}</p>
   <div className="voice-workspace-next">{choices.length?<><p className="calendar-voice-help-title">{copy('Скажите название или номер','Say a name or number','Spune numele sau numărul','说出名称或序号')}</p><div className="voice-workspace-choices">{choices.map((value,index)=><button type="button" key={value} onClick={()=>onSuggestion(value)}><small>{index+1}</small>{value}</button>)}</div></>:<VoiceSuggestions onChoose={onSuggestion} help={!help.filtered?{filtered:true,title:copy('Попробуйте сказать','Try saying','Încearcă să spui','试着说'),phrases:ru?['Что записал вчера?','Потратил 250 лей на продукты','Покажи расходы за прошлый месяц']:help.groups.flatMap(group=>group.phrases).slice(0,3)}:help}/>} {!help.filtered&&!choices.length&&<details className="voice-workspace-all"><summary>{copy('Все команды','All commands','Toate comenzile','全部命令')}</summary><VoiceSuggestions help={help}/></details>}</div>
   <div className="voice-workspace-result" key={resultKey}>{children}</div>
   <details className="voice-workspace-settings"><summary><Settings2 size={14}/>{copy('Звук и голос','Sound and voice','Sunet și voce','声音与语音')}<ChevronDown size={14}/></summary>{settings}</details>
  </div>
  <footer><span>{copy('Говорите → проверьте → «сохрани»','Speak → review → “save”','Spune → verifică → „salvează”','说话 → 核对 → “保存”')}</span><button type="button" disabled={busy} onClick={onListen} aria-label={listening?copy('Готово — обработать фразу','Done — send phrase','Gata — trimite fraza','完成，发送语音'):copy('Продолжить голосом','Continue by voice','Continuă vocal','继续说话')}><Mic size={16}/>{listening?copy('Готово','Done','Gata','完成'):copy('Продолжить','Continue','Continuă','继续')}</button></footer>
 </section>,document.body);
}
