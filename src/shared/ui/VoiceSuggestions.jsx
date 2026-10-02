import React from 'react';
export default function VoiceSuggestions({help}){
 return <div className="calendar-voice-suggestions" data-filtered={help.filtered}>
  <p className="calendar-voice-help-title">{help.title}</p>
  {help.filtered?<>{help.phrases.length?<ul className="calendar-voice-commands calendar-voice-continuations">{help.phrases.map(phrase=><li key={phrase}>{phrase}</li>)}</ul>:<p className="calendar-voice-help-note">{help.empty}</p>}</>:<>
   <div className="calendar-voice-help-groups">{help.groups.map(group=><details key={group.title}><summary><span>{group.title}</span><small>{group.hint}</small></summary><ul className="calendar-voice-commands">{group.phrases.map(phrase=><li key={phrase}>{phrase}</li>)}</ul></details>)}</div>
   <p className="calendar-voice-help-note">{help.note}</p>
  </>}
 </div>;
}
