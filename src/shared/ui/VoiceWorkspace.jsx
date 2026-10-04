import React from 'react';
import {createPortal} from 'react-dom';
import {Mic,Square,Settings2,X,ChevronDown,ChevronUp,GripHorizontal,RotateCcw} from 'lucide-react';
import VoiceSuggestions from './VoiceSuggestions.jsx';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import useFloatingVoiceWindow from './useFloatingVoiceWindow.js';

export default function VoiceWorkspace({locale,isLight,phrase,status,help,contextLabel,pendingPrompt,onClose,onDismissStart,onExpand,onCollapse,onListen,onSuggestion,listening,talking,phase,busy,settings,children,resultKey,choices=[],compact=false}) {
 const floating=useFloatingVoiceWindow();
 const ru=locale==='ru',ro=locale==='ro',zh=locale==='zh';
 const copy=(r,e,m,z)=>ru?r:ro?m:zh?z:e;
 const starting=phase==='starting',reviewing=resultKey==='review'||resultKey==='batch';
 const suggestions=!help.filtered?{filtered:true,title:copy('Например','For example','De exemplu','例如'),phrases:ru?['Потратил 250 лей на продукты','Что записал вчера?','Покажи расходы за прошлый месяц']:help.groups.flatMap(group=>group.phrases).slice(0,3)}:help;
 return createPortal(<SwipeDismissSheet ref={floating.sheetRef} style={floating.style} data-floating={floating.desktop} data-window-dragging={floating.dragging} as="section" onDismiss={onClose} onDismissStart={onDismissStart} disabled={busy||floating.desktop} isLight={isLight} handleClassName="voice-workspace-drag-handle" className="voice-workspace calendar-voice-control" data-light={Boolean(isLight)} data-compact={compact} data-reviewing={reviewing} data-listening={listening} data-talking={talking&&listening} data-phase={phase} role="region" aria-label={copy('Голосовой помощник','Voice assistant','Asistent vocal','语音助手')}>
  <header ref={floating.headerRef} className="voice-workspace-header" title={floating.desktop?copy('Перетащите окно за верхнюю панель','Drag the header to move this window','Trage bara de sus pentru a muta fereastra','拖动顶部可移动窗口'):undefined}><span className="voice-workspace-brand" role={floating.desktop?'button':undefined} tabIndex={floating.desktop?0:undefined} aria-label={floating.desktop?copy('Переместить окно: используйте стрелки','Move window: use arrow keys','Mută fereastra: folosește săgețile','移动窗口：使用方向键'):undefined}>{floating.desktop&&<GripHorizontal className="voice-workspace-grip" size={16}/>}DAYRIS <small>{copy('Голосовой ввод','Voice input','Introducere vocală','语音输入')}</small></span>{floating.moved&&<button type="button" className="voice-workspace-reset" aria-label={copy('Вернуть окно на место','Reset window position','Resetează poziția ferestrei','重置窗口位置')} onClick={floating.reset}><RotateCcw size={14}/></button>}{compact&&<button className="voice-workspace-expand" type="button" aria-label={copy('Развернуть помощника','Expand assistant','Extinde asistentul','展开助手')} onClick={onExpand}><ChevronUp size={18}/></button>}{!compact&&<button type="button" aria-label={copy('Свернуть голосовой режим','Minimize voice mode','Restrânge modul vocal','收起语音模式')} onClick={onCollapse}><ChevronDown size={18}/></button>}</header>
  <div className="voice-workspace-scroll">
   <div className="voice-workspace-hero">
    <p className="voice-workspace-status" role="status">{status}</p>
    <p className="voice-workspace-instruction">{listening?pendingPrompt|| (reviewing?copy('Продолжайте список или скажите «готово» / «сохрани»','Continue the list, or say “done” / “save”','Continuă lista sau spune „gata” / „salvează”','继续说，完成后说“完成”或“保存”'):copy('Говорите. Полную запись сохраню автоматически.','Speak. Complete entries save automatically.','Vorbește. Înregistrările complete se salvează automat.','请说话，完整记录会自动保存。')):starting?copy('Дождитесь включения микрофона','Wait for the microphone to start','Așteaptă pornirea microfonului','请等待麦克风启动'):busy?copy('Один момент','One moment','Un moment','请稍候'):copy('Нажмите микрофон, чтобы говорить','Tap the microphone to speak','Apasă microfonul pentru a vorbi','点击麦克风开始说话')}</p>
   </div>
   <div className="voice-workspace-heard" data-empty={!phrase}><p className="voice-workspace-label">{phrase?copy('Ваша фраза','Your words','Fraza ta','你说的话'):copy('Ваши слова появятся здесь','Your words will appear here','Cuvintele tale vor apărea aici','你说的话会显示在这里')}</p>{phrase&&<p className="voice-workspace-phrase" aria-live="polite">{phrase}</p>}</div>
   {contextLabel&&<p className="voice-workspace-context">{contextLabel}</p>}
   <div className="voice-workspace-result" key={resultKey}>{children}</div>
   <div className="voice-workspace-next">{choices.length?<><p className="calendar-voice-help-title">{copy('Скажите название или номер','Say a name or number','Spune numele sau numărul','说出名称或序号')}</p><div className="voice-workspace-choices">{choices.map((value,index)=><button type="button" key={value} onClick={()=>onSuggestion(value)}><small>{index+1}</small>{value}</button>)}</div></>:<details className="voice-workspace-hints" key={help.filtered?'contextual':'initial'} open={help.filtered||undefined}><summary>{copy('Что можно сказать','What can I say','Ce pot spune','可以说什么')}<ChevronDown size={14}/></summary><VoiceSuggestions onChoose={onSuggestion} help={suggestions}/>{!help.filtered&&<details className="voice-workspace-all"><summary>{copy('Все команды','All commands','Toate comenzile','全部命令')}</summary><VoiceSuggestions help={help}/></details>}</details>}</div>
   <details className="voice-workspace-settings"><summary><Settings2 size={14}/>{copy('Звук и голос','Sound and voice','Sunet și voce','声音与语音')}<ChevronDown size={14}/></summary>{settings}</details>
  </div>

  <footer className="voice-workspace-transport">
   <div className="voice-workspace-transport-state"><span>{listening?copy('Слушаю','Listening','Ascult','聆听中'):starting?copy('Включаю…','Starting…','Pornesc…','启动中'):busy?copy('Обрабатываю…','Processing…','Procesez…','处理中'):phase==='speaking'?copy('Отвечаю…','Speaking…','Răspund…','回答中'):copy('Микрофон на паузе','Microphone paused','Microfon pe pauză','麦克风已暂停')}</span>
    <div className="voice-workspace-wave" aria-hidden="true">{Array.from({length:13},(_,i)=><i key={i} style={{'--bar':i,'--height':`${12+[3,7,15,23,32,22,38,25,30,20,13,7,3][i]}px`}}/>)}</div>
   </div>
    <button className="voice-workspace-mic" type="button" disabled={busy||starting} onClick={onListen} aria-label={listening?copy('Готово — обработать фразу','Done — send phrase','Gata — trimite fraza','完成，发送语音'):copy('Продолжить голосом','Continue by voice','Continuă vocal','继续说话')} aria-pressed={listening}><Mic size={30}/><span className="voice-workspace-mic-stop"><Square size={12}/></span></button>
   <button className="voice-workspace-exit" type="button" aria-label={copy('Закрыть голосовой режим','Close voice mode','Închide modul vocal','关闭语音模式')} disabled={busy} onClick={onClose}><X size={18}/><span>{copy('Выйти','Exit','Ieși','退出')}</span></button>
  </footer>
 </SwipeDismissSheet>,document.body);
}
