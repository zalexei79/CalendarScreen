import React from 'react';
export default function VoiceSuggestions({help,onChoose}){
 const guide=phrase=>({'[сумма] [валюта]':'Сумма и валюта','[сумма]':'Назовите сумму','[валюта]':'Назовите валюту','на [категория]':help.intent==='plus'?'Источник дохода':'На что потратили','вчера / сегодня':'Дата · вчера или сегодня','[amount] [currency]':'Amount and currency','[amount]':'Say the amount','[currency]':'Say the currency','on [category]':help.intent==='plus'?'Income source':'What you spent on','[sumă] [monedă]':'Suma și moneda','[sumă]':'Spune suma','[monedă]':'Spune moneda','pe [categorie]':help.intent==='plus'?'Sursa venitului':'Pe ce ai cheltuit','[金额] [货币]':'金额与货币','[金额]':'请说出金额','[货币]':'请说出货币','用于[类别]':help.intent==='plus'?'收入来源':'消费类别'}[phrase]||phrase.replace(/\s*\/\s*/g,' · '));
 return <div className="calendar-voice-suggestions" data-filtered={help.filtered}>
  <p className="calendar-voice-help-title">{help.title}</p>
  {help.filtered?<>{help.phrases.length?<ul className="calendar-voice-commands calendar-voice-continuations">{help.phrases.map(phrase=><li key={phrase}>{onChoose&&!/[\[\/]/.test(phrase)&&!/^После паузы|^Pause, then|^După pauză|^暂停后/.test(phrase)?<button type="button" onClick={()=>onChoose(phrase)}>{phrase}<span aria-hidden="true">↗</span></button>:<span className="voice-slot-hint">{guide(phrase)}</span>}</li>)}</ul>:<p className="calendar-voice-help-note">{help.empty}</p>}</>:<>
   <div className="calendar-voice-help-groups">{help.groups.map(group=><details key={group.title}><summary><span>{group.title}</span><small>{group.hint}</small></summary><ul className="calendar-voice-commands">{group.phrases.map(phrase=><li key={phrase}>{phrase}</li>)}</ul></details>)}</div>
   <p className="calendar-voice-help-note">{help.note}</p>
  </>}
 </div>;
}
